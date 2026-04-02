pub mod install;
pub mod manifest;
pub mod state;
pub mod types;

use crate::updater::install::install_prepared_update;
use crate::updater::manifest::{fetch_manifest, prepare_update};
use crate::updater::state::{
    ensure_official_install, load_state, mark_checked, official_install_root, save_state,
    should_check_now,
};
pub use crate::updater::types::{
    AutomaticUpdateOutcome, CheckOutcome, InstallOutcome, UpdateManifest, UpdaterError,
    UpdaterState,
};
use chrono::Utc;

pub async fn check_for_updates(
    current_version: &str,
    ignore_cooldown: bool,
) -> Result<CheckOutcome, UpdaterError> {
    let client = reqwest::Client::builder()
        .user_agent(format!("dsp/{}", current_version.trim()))
        .build()?;

    let mut state = load_state()?;
    let now = Utc::now();
    if !should_check_now(&state, now, ignore_cooldown) {
        return Ok(CheckOutcome::UpToDate {
            current_version: current_version.to_string(),
        });
    }

    let manifest = fetch_manifest(&client).await?;
    mark_checked(&mut state, now, Some(manifest.version.clone()));
    save_state(&state)?;

    let current_exe = std::env::current_exe()?;
    let install_root = official_install_root()?;
    let official_install = ensure_official_install(&current_exe).is_ok();
    match prepare_update(
        current_version,
        current_exe,
        install_root,
        official_install,
        manifest,
    )? {
        Some(prepared) => Ok(CheckOutcome::UpdateAvailable {
            current_version: prepared.current_version.to_string(),
            latest_version: prepared.latest_version.to_string(),
            notes_url: prepared.manifest.notes_url,
            official_install: prepared.official_install,
        }),
        None => Ok(CheckOutcome::UpToDate {
            current_version: current_version.to_string(),
        }),
    }
}

pub async fn self_update(current_version: &str) -> Result<InstallOutcome, UpdaterError> {
    let client = reqwest::Client::builder()
        .user_agent(format!("dsp/{}", current_version.trim()))
        .build()?;

    let manifest = fetch_manifest(&client).await?;
    let current_exe = std::env::current_exe()?;
    let install_root = ensure_official_install(&current_exe)?;
    let Some(prepared) =
        prepare_update(current_version, current_exe, install_root, true, manifest)?
    else {
        return Ok(InstallOutcome::UpToDate {
            current_version: current_version.to_string(),
        });
    };

    let result = install_prepared_update(&client, &prepared).await?;
    if matches!(
        result,
        InstallOutcome::Installed { .. } | InstallOutcome::StagedWindowsReplacement { .. }
    ) {
        persist_successful_state(&prepared.latest_version.to_string())?;
    }
    Ok(result)
}

pub async fn automatic_startup_update(
    current_version: &str,
) -> Result<AutomaticUpdateOutcome, UpdaterError> {
    let client = reqwest::Client::builder()
        .user_agent(format!("dsp/{}", current_version.trim()))
        .build()?;

    let mut state = load_state()?;
    if !state.auto_update {
        return Ok(AutomaticUpdateOutcome::Disabled);
    }

    let now = Utc::now();
    if !should_check_now(&state, now, false) {
        return Ok(AutomaticUpdateOutcome::SkippedCooldown);
    }

    let manifest = fetch_manifest(&client).await?;
    mark_checked(&mut state, now, Some(manifest.version.clone()));
    save_state(&state)?;

    let current_exe = std::env::current_exe()?;
    let install_root = official_install_root()?;
    let official_install = ensure_official_install(&current_exe).is_ok();
    let Some(prepared) = prepare_update(
        current_version,
        current_exe,
        install_root,
        official_install,
        manifest,
    )?
    else {
        return Ok(AutomaticUpdateOutcome::UpToDate {
            current_version: current_version.to_string(),
        });
    };

    if !prepared.official_install {
        return Ok(AutomaticUpdateOutcome::UpdateAvailable {
            current_version: prepared.current_version.to_string(),
            latest_version: prepared.latest_version.to_string(),
            official_install: false,
        });
    }

    match install_prepared_update(&client, &prepared).await {
        Ok(InstallOutcome::Installed {
            previous_version,
            new_version,
        }) => {
            persist_successful_state(&new_version)?;
            Ok(AutomaticUpdateOutcome::Updated {
                previous_version,
                new_version,
            })
        }
        Ok(InstallOutcome::StagedWindowsReplacement {
            previous_version,
            new_version,
        }) => {
            persist_successful_state(&new_version)?;
            Ok(AutomaticUpdateOutcome::Updated {
                previous_version,
                new_version,
            })
        }
        Ok(InstallOutcome::UpToDate { current_version }) => {
            Ok(AutomaticUpdateOutcome::UpToDate { current_version })
        }
        Err(error) => Ok(AutomaticUpdateOutcome::UpdateFailed {
            current_version: prepared.current_version.to_string(),
            latest_version: prepared.latest_version.to_string(),
            reason: error.to_string(),
            official_install: true,
        }),
    }
}

fn persist_successful_state(version: &str) -> Result<(), UpdaterError> {
    let mut state = load_state()?;
    mark_checked(&mut state, Utc::now(), Some(version.to_string()));
    save_state(&state)
}
