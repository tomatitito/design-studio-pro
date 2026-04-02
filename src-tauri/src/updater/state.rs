#[cfg(windows)]
use crate::updater::types::OFFICIAL_WINDOWS_INSTALL_DIR;
use crate::updater::types::{
    UpdaterError, UpdaterState, DEFAULT_COOLDOWN_HOURS, OFFICIAL_UNIX_INSTALL_DIR, STATE_FILE_NAME,
};
use chrono::{Duration, Utc};
use std::fs;
use std::path::{Path, PathBuf};

pub fn state_file_path() -> Result<PathBuf, UpdaterError> {
    let config_dir = config_dir()?;
    Ok(config_dir.join(STATE_FILE_NAME))
}

pub fn load_state() -> Result<UpdaterState, UpdaterError> {
    let path = state_file_path()?;
    if !path.exists() {
        return Ok(UpdaterState::default());
    }

    let bytes = fs::read(path)?;
    Ok(serde_json::from_slice::<UpdaterState>(&bytes)?)
}

pub fn save_state(state: &UpdaterState) -> Result<(), UpdaterError> {
    let path = state_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let bytes = serde_json::to_vec_pretty(state)?;
    fs::write(path, bytes)?;
    Ok(())
}

pub fn should_check_now(
    state: &UpdaterState,
    now: chrono::DateTime<Utc>,
    ignore_cooldown: bool,
) -> bool {
    if ignore_cooldown {
        return true;
    }

    match state.last_checked_at {
        Some(last_checked_at) => now - last_checked_at >= Duration::hours(DEFAULT_COOLDOWN_HOURS),
        None => true,
    }
}

pub fn mark_checked(
    state: &mut UpdaterState,
    now: chrono::DateTime<Utc>,
    last_seen_version: Option<String>,
) {
    state.last_checked_at = Some(now);
    if let Some(version) = last_seen_version {
        state.last_seen_version = Some(version);
    }
}

pub fn config_dir() -> Result<PathBuf, UpdaterError> {
    #[cfg(windows)]
    {
        if let Some(path) = std::env::var_os("APPDATA") {
            return Ok(PathBuf::from(path).join("DesignStudioPro"));
        }
    }

    #[cfg(not(windows))]
    {
        if let Some(path) = std::env::var_os("XDG_CONFIG_HOME") {
            return Ok(PathBuf::from(path).join("design-studio-pro"));
        }

        if let Some(path) = std::env::var_os("HOME") {
            return Ok(PathBuf::from(path)
                .join(".config")
                .join("design-studio-pro"));
        }
    }

    Err(UpdaterError::Config(
        "could not resolve a config directory for updater state".to_string(),
    ))
}

pub fn official_install_root() -> Result<PathBuf, UpdaterError> {
    #[cfg(windows)]
    {
        if let Some(path) = std::env::var_os("LOCALAPPDATA") {
            return Ok(PathBuf::from(path).join(OFFICIAL_WINDOWS_INSTALL_DIR));
        }

        return Err(UpdaterError::Config(
            "LOCALAPPDATA is not set; cannot resolve the official install directory".to_string(),
        ));
    }

    #[cfg(not(windows))]
    {
        if let Some(path) = std::env::var_os("HOME") {
            return Ok(PathBuf::from(path).join(OFFICIAL_UNIX_INSTALL_DIR));
        }

        Err(UpdaterError::Config(
            "HOME is not set; cannot resolve the official install directory".to_string(),
        ))
    }
}

pub fn is_official_install_path(path: &Path, install_root: &Path) -> bool {
    let canonical_binary = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let canonical_root =
        fs::canonicalize(install_root).unwrap_or_else(|_| install_root.to_path_buf());
    canonical_binary.starts_with(canonical_root)
}

pub fn ensure_official_install(path: &Path) -> Result<PathBuf, UpdaterError> {
    let install_root = official_install_root()?;
    if is_official_install_path(path, &install_root) {
        return Ok(install_root);
    }

    Err(UpdaterError::UnsupportedInstallPath {
        current_exe: path.to_path_buf(),
        expected_root: install_root,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn should_check_now_honors_cooldown() {
        let last_checked_at = Utc.with_ymd_and_hms(2026, 4, 1, 12, 0, 0).unwrap();
        let now = Utc.with_ymd_and_hms(2026, 4, 2, 11, 59, 59).unwrap();
        let state = UpdaterState {
            last_checked_at: Some(last_checked_at),
            last_seen_version: None,
            auto_update: true,
        };

        assert!(!should_check_now(&state, now, false));
        assert!(should_check_now(&state, now, true));
    }

    #[test]
    fn should_check_now_allows_after_cooldown() {
        let last_checked_at = Utc.with_ymd_and_hms(2026, 4, 1, 12, 0, 0).unwrap();
        let now = Utc.with_ymd_and_hms(2026, 4, 2, 12, 0, 0).unwrap();
        let state = UpdaterState {
            last_checked_at: Some(last_checked_at),
            last_seen_version: None,
            auto_update: true,
        };

        assert!(should_check_now(&state, now, false));
    }

    #[test]
    fn mark_checked_updates_timestamp_and_version() {
        let now = Utc.with_ymd_and_hms(2026, 4, 2, 12, 0, 0).unwrap();
        let mut state = UpdaterState::default();
        mark_checked(&mut state, now, Some("0.2.0".to_string()));
        assert_eq!(state.last_checked_at, Some(now));
        assert_eq!(state.last_seen_version.as_deref(), Some("0.2.0"));
    }

    #[test]
    fn official_install_path_check_is_prefix_based() {
        let install_root = if cfg!(windows) {
            PathBuf::from(r"C:\Users\alice\AppData\Local\DesignStudioPro\bin")
        } else {
            PathBuf::from("/Users/alice/.design-studio-pro/bin")
        };

        let binary = if cfg!(windows) {
            install_root.join("dsp.exe")
        } else {
            install_root.join("dsp")
        };

        assert!(is_official_install_path(&binary, &install_root));
    }
}
