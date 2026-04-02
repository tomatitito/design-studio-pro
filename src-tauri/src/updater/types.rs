use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::PathBuf;

pub const UPDATE_MANIFEST_NAME: &str = "dsp-updates.json";
pub const CHECKSUMS_FILE_NAME: &str = "dsp-checksums.txt";
pub const STATE_FILE_NAME: &str = "dsp-updater.json";
pub const OFFICIAL_UNIX_INSTALL_DIR: &str = ".design-studio-pro/bin";
pub const OFFICIAL_WINDOWS_INSTALL_DIR: &str = "DesignStudioPro\\bin";
pub const DEFAULT_COOLDOWN_HOURS: i64 = 24;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateManifest {
    pub version: String,
    pub published_at: DateTime<Utc>,
    pub notes_url: String,
    pub assets: std::collections::BTreeMap<String, UpdateAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateAsset {
    pub url: String,
    pub sha256: String,
    pub archive: ArchiveFormat,
    pub binary_path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ArchiveFormat {
    #[serde(rename = "tar.gz")]
    TarGz,
    Zip,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdaterState {
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_seen_version: Option<String>,
    #[serde(default = "default_true")]
    pub auto_update: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckOutcome {
    UpToDate {
        current_version: String,
    },
    UpdateAvailable {
        current_version: String,
        latest_version: String,
        notes_url: String,
        official_install: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AutomaticUpdateOutcome {
    SkippedCooldown,
    Disabled,
    UpToDate {
        current_version: String,
    },
    Updated {
        previous_version: String,
        new_version: String,
    },
    UpdateAvailable {
        current_version: String,
        latest_version: String,
        official_install: bool,
    },
    UpdateFailed {
        current_version: String,
        latest_version: String,
        reason: String,
        official_install: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallOutcome {
    UpToDate {
        current_version: String,
    },
    Installed {
        previous_version: String,
        new_version: String,
    },
    StagedWindowsReplacement {
        previous_version: String,
        new_version: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedUpdate {
    pub current_version: Version,
    pub latest_version: Version,
    pub manifest: UpdateManifest,
    pub asset_target: String,
    pub asset: UpdateAsset,
    pub official_install: bool,
    pub current_exe: PathBuf,
    pub install_root: PathBuf,
}

#[derive(Debug)]
pub enum UpdaterError {
    Config(String),
    UnsupportedPlatform(String),
    UnsupportedInstallPath {
        current_exe: PathBuf,
        expected_root: PathBuf,
    },
    Network(reqwest::Error),
    HttpStatus(reqwest::StatusCode),
    Io(std::io::Error),
    Json(serde_json::Error),
    Version(semver::Error),
    ChecksumMismatch {
        expected: String,
        actual: String,
    },
    MissingAsset(String),
    InvalidArchive(String),
    InvalidManifest(String),
}

impl fmt::Display for UpdaterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Config(message) => write!(f, "{message}"),
            Self::UnsupportedPlatform(message) => write!(f, "{message}"),
            Self::UnsupportedInstallPath {
                current_exe,
                expected_root,
            } => write!(
                f,
                "self-update is supported only for official installs under {} (current binary: {})",
                expected_root.display(),
                current_exe.display()
            ),
            Self::Network(error) => write!(f, "{error}"),
            Self::HttpStatus(status) => write!(f, "update server returned HTTP {status}"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Json(error) => write!(f, "{error}"),
            Self::Version(error) => write!(f, "{error}"),
            Self::ChecksumMismatch { expected, actual } => {
                write!(f, "checksum mismatch (expected {expected}, got {actual})")
            }
            Self::MissingAsset(target) => {
                write!(f, "no update artifact is available for target {target}")
            }
            Self::InvalidArchive(message) => write!(f, "{message}"),
            Self::InvalidManifest(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for UpdaterError {}

impl From<std::io::Error> for UpdaterError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for UpdaterError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

impl From<reqwest::Error> for UpdaterError {
    fn from(value: reqwest::Error) -> Self {
        Self::Network(value)
    }
}

impl From<semver::Error> for UpdaterError {
    fn from(value: semver::Error) -> Self {
        Self::Version(value)
    }
}

impl Default for UpdaterState {
    fn default() -> Self {
        Self {
            last_checked_at: None,
            last_seen_version: None,
            auto_update: true,
        }
    }
}

fn default_true() -> bool {
    true
}
