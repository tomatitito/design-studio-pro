use crate::updater::manifest::{is_newer_version, parse_version};
use crate::updater::types::UpdaterError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const DESKTOP_UPDATE_MANIFEST_NAME: &str = "dsp-desktop-updates.json";
const DESKTOP_CHANNEL: &str = "desktop";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DesktopUpdateManifest {
    pub channel: String,
    pub version: String,
    pub published_at: DateTime<Utc>,
    pub notes_url: String,
    pub assets: BTreeMap<String, DesktopUpdateAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DesktopUpdateAsset {
    pub url: String,
    pub sha256: String,
    pub artifact_name: String,
    pub artifact_kind: DesktopArtifactKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopArtifactKind {
    DesktopInstaller,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DesktopUpdateOutcome {
    UpToDate {
        current_version: String,
    },
    UpdateAvailable {
        current_version: String,
        latest_version: String,
        notes_url: String,
        asset_url: String,
        artifact_name: String,
    },
}

pub fn desktop_manifest_url() -> Result<String, UpdaterError> {
    if let Some(url) =
        option_env!("DSP_DESKTOP_UPDATE_MANIFEST_URL").filter(|value| !value.trim().is_empty())
    {
        return Ok(url.to_string());
    }

    if let Some(base_url) =
        option_env!("DSP_DESKTOP_UPDATE_BASE_URL").filter(|value| !value.trim().is_empty())
    {
        return Ok(format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            DESKTOP_UPDATE_MANIFEST_NAME
        ));
    }

    let repository = option_env!("CARGO_PKG_REPOSITORY")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            UpdaterError::Config(
                "Desktop update check is not configured for this build. Please download the latest installer from the official release page."
                    .to_string(),
            )
        })?;

    let repository = repository.trim_end_matches('/').trim_end_matches(".git");
    Ok(format!(
        "{repository}/releases/latest/download/{DESKTOP_UPDATE_MANIFEST_NAME}"
    ))
}

pub async fn check_for_desktop_updates(
    current_version: &str,
) -> Result<DesktopUpdateOutcome, UpdaterError> {
    let client = reqwest::Client::builder()
        .user_agent(format!("design-studio-pro/{}", current_version.trim()))
        .build()?;

    let manifest = fetch_desktop_manifest(&client).await?;
    prepare_desktop_update(current_version, manifest)
}

pub async fn fetch_desktop_manifest(
    client: &reqwest::Client,
) -> Result<DesktopUpdateManifest, UpdaterError> {
    fetch_desktop_manifest_from_url(client, &desktop_manifest_url()?).await
}

pub async fn fetch_desktop_manifest_from_url(
    client: &reqwest::Client,
    url: &str,
) -> Result<DesktopUpdateManifest, UpdaterError> {
    let response = client.get(url).send().await?;
    let status = response.status();
    if !status.is_success() {
        return Err(UpdaterError::HttpStatus(status));
    }

    let body = response.text().await?;
    parse_desktop_manifest(&body)
}

pub fn parse_desktop_manifest(body: &str) -> Result<DesktopUpdateManifest, UpdaterError> {
    let manifest: DesktopUpdateManifest = serde_json::from_str(body)?;
    validate_desktop_manifest(&manifest)?;
    Ok(manifest)
}

pub fn prepare_desktop_update(
    current_version: &str,
    manifest: DesktopUpdateManifest,
) -> Result<DesktopUpdateOutcome, UpdaterError> {
    let current = parse_version(current_version)?;
    let latest = parse_version(&manifest.version)?;

    if !is_newer_version(&current, &latest) {
        return Ok(DesktopUpdateOutcome::UpToDate {
            current_version: current.to_string(),
        });
    }

    let target = resolve_desktop_target()?;
    let asset = manifest
        .assets
        .get(&target)
        .ok_or_else(|| UpdaterError::MissingAsset(target.clone()))?;

    Ok(DesktopUpdateOutcome::UpdateAvailable {
        current_version: current.to_string(),
        latest_version: latest.to_string(),
        notes_url: manifest.notes_url,
        asset_url: asset.url.clone(),
        artifact_name: asset.artifact_name.clone(),
    })
}

pub fn resolve_desktop_target() -> Result<String, UpdaterError> {
    resolve_desktop_target_for(std::env::consts::OS, std::env::consts::ARCH)
}

pub fn resolve_desktop_target_for(os: &str, arch: &str) -> Result<String, UpdaterError> {
    match (os, arch) {
        ("macos", "x86_64") => Ok("desktop-macos-x86_64".to_string()),
        ("macos", "aarch64") => Ok("desktop-macos-aarch64".to_string()),
        ("linux", "x86_64") => Ok("desktop-linux-x86_64".to_string()),
        ("windows", "x86_64") => Ok("desktop-windows-x86_64".to_string()),
        (os, arch) => Err(UpdaterError::UnsupportedPlatform(format!(
            "Desktop updates are not available for {os} on {arch}."
        ))),
    }
}

fn validate_desktop_manifest(manifest: &DesktopUpdateManifest) -> Result<(), UpdaterError> {
    if manifest.channel != DESKTOP_CHANNEL {
        return Err(UpdaterError::InvalidManifest(
            "desktop update metadata has the wrong channel".to_string(),
        ));
    }

    parse_version(&manifest.version)?;
    validate_github_release_url(&manifest.notes_url, "/releases/tag/")?;

    if manifest.assets.is_empty() {
        return Err(UpdaterError::InvalidManifest(
            "desktop update metadata does not contain any installers".to_string(),
        ));
    }

    for (target, asset) in &manifest.assets {
        validate_desktop_asset(target, asset)?;
    }

    Ok(())
}

fn validate_desktop_asset(target: &str, asset: &DesktopUpdateAsset) -> Result<(), UpdaterError> {
    let expected_extensions = expected_desktop_extensions(target).ok_or_else(|| {
        UpdaterError::InvalidManifest(format!(
            "desktop update target {target} is not a supported desktop target"
        ))
    })?;

    validate_github_release_url(&asset.url, "/releases/download/")?;

    if asset.sha256.trim().len() != 64 || !asset.sha256.chars().all(|char| char.is_ascii_hexdigit())
    {
        return Err(UpdaterError::InvalidManifest(format!(
            "desktop installer sha256 for target {target} must be a 64-character hex string"
        )));
    }

    let artifact_name = asset.artifact_name.trim();
    if artifact_name.is_empty() || artifact_name.contains('/') || artifact_name.contains('\\') {
        return Err(UpdaterError::InvalidManifest(format!(
            "desktop installer artifact_name for target {target} is invalid"
        )));
    }

    if artifact_name == "dsp" || artifact_name == "dsp.exe" || artifact_name.starts_with("dsp-") {
        return Err(UpdaterError::InvalidManifest(format!(
            "desktop installer artifact_name for target {target} looks like a CLI artifact"
        )));
    }

    if !expected_extensions
        .iter()
        .any(|extension| artifact_name.ends_with(extension))
    {
        return Err(UpdaterError::InvalidManifest(format!(
            "desktop installer artifact_name for target {target} has unsupported extension"
        )));
    }

    let encoded_artifact_name = encode_url_path_segment(artifact_name);
    if !asset.url.ends_with(artifact_name) && !asset.url.ends_with(&encoded_artifact_name) {
        return Err(UpdaterError::InvalidManifest(format!(
            "desktop installer URL for target {target} must point to artifact_name"
        )));
    }

    Ok(())
}

fn encode_url_path_segment(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            byte => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

fn expected_desktop_extensions(target: &str) -> Option<&'static [&'static str]> {
    match target {
        "desktop-windows-x86_64" => Some(&[".exe", ".msi"]),
        "desktop-macos-x86_64" | "desktop-macos-aarch64" => Some(&[".dmg"]),
        "desktop-linux-x86_64" => Some(&[".AppImage", ".deb", ".rpm"]),
        _ => None,
    }
}

fn validate_github_release_url(url: &str, required_path_part: &str) -> Result<(), UpdaterError> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| {
        UpdaterError::InvalidManifest("desktop update metadata contains invalid URL".to_string())
    })?;

    if parsed.scheme() != "https" || parsed.host_str() != Some("github.com") {
        return Err(UpdaterError::InvalidManifest(
            "desktop update URLs must use https://github.com".to_string(),
        ));
    }

    if !parsed.path().contains(required_path_part) {
        return Err(UpdaterError::InvalidManifest(
            "desktop update URL is not a GitHub release URL".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    #[test]
    fn packaged_desktop_build_embeds_manifest_url_when_required() {
        if std::env::var_os("DSP_TEST_REQUIRE_DESKTOP_UPDATE_URL").is_none() {
            return;
        }

        assert_eq!(
            desktop_manifest_url().unwrap(),
            "https://github.com/example/design-studio-pro/releases/latest/download/dsp-desktop-updates.json"
        );
    }

    #[test]
    fn parse_desktop_manifest_accepts_desktop_installer() {
        let body = format!(
            r#"{{
              "channel":"desktop",
              "version":"0.2.0",
              "published_at":"2026-04-01T12:00:00Z",
              "notes_url":"https://github.com/example/design-studio-pro/releases/tag/v0.2.0",
              "assets":{{
                "desktop-windows-x86_64":{{
                  "url":"https://github.com/example/design-studio-pro/releases/download/v0.2.0/Design_Studio_Pro_0.2.0_x64-setup.exe",
                  "sha256":"{HASH}",
                  "artifact_name":"Design_Studio_Pro_0.2.0_x64-setup.exe",
                  "artifact_kind":"desktop-installer"
                }}
              }}
            }}"#
        );

        let manifest = parse_desktop_manifest(&body).unwrap();
        assert_eq!(manifest.channel, "desktop");
    }

    #[test]
    fn parse_desktop_manifest_rejects_cli_channel() {
        let body = format!(
            r#"{{
              "channel":"cli",
              "version":"0.2.0",
              "published_at":"2026-04-01T12:00:00Z",
              "notes_url":"https://github.com/example/design-studio-pro/releases/tag/v0.2.0",
              "assets":{{
                "x86_64-pc-windows-msvc":{{
                  "url":"https://example.com/dsp-x86_64-pc-windows-msvc.zip",
                  "sha256":"{HASH}",
                  "artifact_name":"dsp-x86_64-pc-windows-msvc.zip",
                  "artifact_kind":"desktop-installer"
                }}
              }}
            }}"#
        );

        let error = parse_desktop_manifest(&body).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidManifest(_)));
    }

    #[test]
    fn parse_desktop_manifest_rejects_cli_artifact_name() {
        let body = format!(
            r#"{{
              "channel":"desktop",
              "version":"0.2.0",
              "published_at":"2026-04-01T12:00:00Z",
              "notes_url":"https://github.com/example/design-studio-pro/releases/tag/v0.2.0",
              "assets":{{
                "desktop-windows-x86_64":{{
                  "url":"https://example.com/dsp-x86_64-pc-windows-msvc.zip",
                  "sha256":"{HASH}",
                  "artifact_name":"dsp-x86_64-pc-windows-msvc.zip",
                  "artifact_kind":"desktop-installer"
                }}
              }}
            }}"#
        );

        let error = parse_desktop_manifest(&body).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidManifest(_)));
    }

    #[test]
    fn parse_desktop_manifest_rejects_non_github_url() {
        let body = format!(
            r#"{{
              "channel":"desktop",
              "version":"0.2.0",
              "published_at":"2026-04-01T12:00:00Z",
              "notes_url":"https://github.com/example/design-studio-pro/releases/tag/v0.2.0",
              "assets":{{
                "desktop-windows-x86_64":{{
                  "url":"https://example.com/releases/download/v0.2.0/Design_Studio_Pro_0.2.0_x64-setup.exe",
                  "sha256":"{HASH}",
                  "artifact_name":"Design_Studio_Pro_0.2.0_x64-setup.exe",
                  "artifact_kind":"desktop-installer"
                }}
              }}
            }}"#
        );

        let error = parse_desktop_manifest(&body).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidManifest(_)));
    }

    #[test]
    fn parse_desktop_manifest_rejects_wrong_artifact_extension() {
        let body = format!(
            r#"{{
              "channel":"desktop",
              "version":"0.2.0",
              "published_at":"2026-04-01T12:00:00Z",
              "notes_url":"https://github.com/example/design-studio-pro/releases/tag/v0.2.0",
              "assets":{{
                "desktop-windows-x86_64":{{
                  "url":"https://github.com/example/design-studio-pro/releases/download/v0.2.0/Design_Studio_Pro_0.2.0_x64.tar.gz",
                  "sha256":"{HASH}",
                  "artifact_name":"Design_Studio_Pro_0.2.0_x64.tar.gz",
                  "artifact_kind":"desktop-installer"
                }}
              }}
            }}"#
        );

        let error = parse_desktop_manifest(&body).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidManifest(_)));
    }

    #[test]
    fn resolve_desktop_target_uses_desktop_namespace() {
        assert_eq!(
            resolve_desktop_target_for("windows", "x86_64").unwrap(),
            "desktop-windows-x86_64"
        );
        assert_eq!(
            resolve_desktop_target_for("macos", "aarch64").unwrap(),
            "desktop-macos-aarch64"
        );
    }

    #[test]
    fn prepare_desktop_update_reports_up_to_date() {
        let manifest = sample_manifest("0.1.0");
        assert!(matches!(
            prepare_desktop_update("0.1.0", manifest).unwrap(),
            DesktopUpdateOutcome::UpToDate { .. }
        ));
    }

    #[test]
    fn prepare_desktop_update_selects_current_desktop_asset() {
        let manifest = sample_manifest("0.2.0");
        let outcome = prepare_desktop_update("0.1.0", manifest).unwrap();

        match outcome {
            DesktopUpdateOutcome::UpdateAvailable {
                latest_version,
                artifact_name,
                ..
            } => {
                assert_eq!(latest_version, "0.2.0");
                assert_eq!(artifact_name, "Design_Studio_Pro_0.2.0_x64-setup.exe");
            }
            DesktopUpdateOutcome::UpToDate { .. } => panic!("expected update"),
        }
    }

    fn sample_manifest(version: &str) -> DesktopUpdateManifest {
        let mut assets = BTreeMap::new();
        assets.insert(
            resolve_desktop_target().unwrap_or_else(|_| "desktop-windows-x86_64".to_string()),
            DesktopUpdateAsset {
                url: "https://github.com/example/design-studio-pro/releases/download/v0.2.0/Design_Studio_Pro_0.2.0_x64-setup.exe".to_string(),
                sha256: HASH.to_string(),
                artifact_name: "Design_Studio_Pro_0.2.0_x64-setup.exe".to_string(),
                artifact_kind: DesktopArtifactKind::DesktopInstaller,
            },
        );
        DesktopUpdateManifest {
            channel: "desktop".to_string(),
            version: version.to_string(),
            published_at: Utc::now(),
            notes_url: "https://github.com/example/design-studio-pro/releases/tag/v0.2.0"
                .to_string(),
            assets,
        }
    }
}
