use crate::updater::types::{
    PreparedUpdate, UpdateAsset, UpdateManifest, UpdaterError, UPDATE_MANIFEST_NAME,
};
use semver::Version;

pub fn manifest_url() -> Result<String, UpdaterError> {
    if let Ok(url) = std::env::var("DSP_UPDATE_MANIFEST_URL") {
        if !url.trim().is_empty() {
            return Ok(url);
        }
    }

    if let Ok(base_url) = std::env::var("DSP_UPDATE_BASE_URL") {
        if !base_url.trim().is_empty() {
            return Ok(format!(
                "{}/{}",
                base_url.trim_end_matches('/'),
                UPDATE_MANIFEST_NAME
            ));
        }
    }

    if let Some(base_url) =
        option_env!("DSP_UPDATE_BASE_URL").filter(|value| !value.trim().is_empty())
    {
        return Ok(format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            UPDATE_MANIFEST_NAME
        ));
    }

    let repository = option_env!("CARGO_PKG_REPOSITORY")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            UpdaterError::Config(
                "update manifest URL is not configured; set DSP_UPDATE_BASE_URL, DSP_UPDATE_MANIFEST_URL, or Cargo package.repository"
                    .to_string(),
            )
        })?;

    let repository = repository.trim_end_matches('/');
    let repository = repository.trim_end_matches(".git");

    Ok(format!(
        "{repository}/releases/latest/download/{UPDATE_MANIFEST_NAME}"
    ))
}

pub async fn fetch_manifest(client: &reqwest::Client) -> Result<UpdateManifest, UpdaterError> {
    fetch_manifest_from_url(client, &manifest_url()?).await
}

pub async fn fetch_manifest_from_url(
    client: &reqwest::Client,
    url: &str,
) -> Result<UpdateManifest, UpdaterError> {
    let response = client.get(url).send().await?;
    let status = response.status();
    if !status.is_success() {
        return Err(UpdaterError::HttpStatus(status));
    }

    let body = response.text().await?;
    parse_manifest(&body)
}

pub fn parse_manifest(body: &str) -> Result<UpdateManifest, UpdaterError> {
    let manifest: UpdateManifest = serde_json::from_str(body)?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

pub fn validate_manifest(manifest: &UpdateManifest) -> Result<(), UpdaterError> {
    if manifest.assets.is_empty() {
        return Err(UpdaterError::InvalidManifest(
            "update manifest does not contain any assets".to_string(),
        ));
    }

    parse_version(&manifest.version)?;

    for (target, asset) in &manifest.assets {
        validate_asset(target, asset)?;
    }

    Ok(())
}

pub fn resolve_target() -> Result<String, UpdaterError> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "x86_64") => Ok("x86_64-apple-darwin".to_string()),
        ("macos", "aarch64") => Ok("aarch64-apple-darwin".to_string()),
        ("linux", "x86_64") => Ok("x86_64-unknown-linux-gnu".to_string()),
        ("windows", "x86_64") => Ok("x86_64-pc-windows-msvc".to_string()),
        (os, arch) => Err(UpdaterError::UnsupportedPlatform(format!(
            "self-update is not supported on target {arch}-{os}"
        ))),
    }
}

pub fn resolve_asset<'a>(
    manifest: &'a UpdateManifest,
    target: &str,
) -> Result<&'a UpdateAsset, UpdaterError> {
    manifest
        .assets
        .get(target)
        .ok_or_else(|| UpdaterError::MissingAsset(target.to_string()))
}

pub fn parse_version(version: &str) -> Result<Version, UpdaterError> {
    Ok(Version::parse(version.trim_start_matches('v'))?)
}

pub fn is_newer_version(current_version: &Version, latest_version: &Version) -> bool {
    latest_version > current_version
}

pub fn prepare_update(
    current_version: &str,
    current_exe: std::path::PathBuf,
    install_root: std::path::PathBuf,
    official_install: bool,
    manifest: UpdateManifest,
) -> Result<Option<PreparedUpdate>, UpdaterError> {
    let current_version = parse_version(current_version)?;
    let latest_version = parse_version(&manifest.version)?;
    if !is_newer_version(&current_version, &latest_version) {
        return Ok(None);
    }

    let target = resolve_target()?;
    let asset = resolve_asset(&manifest, &target)?.clone();

    Ok(Some(PreparedUpdate {
        current_version,
        latest_version,
        manifest,
        asset_target: target,
        asset,
        official_install,
        current_exe,
        install_root,
    }))
}

fn validate_asset(target: &str, asset: &UpdateAsset) -> Result<(), UpdaterError> {
    if asset.url.trim().is_empty() {
        return Err(UpdaterError::InvalidManifest(format!(
            "asset URL for target {target} is empty"
        )));
    }

    if asset.sha256.trim().len() != 64 || !asset.sha256.chars().all(|char| char.is_ascii_hexdigit())
    {
        return Err(UpdaterError::InvalidManifest(format!(
            "asset sha256 for target {target} must be a 64-character hex string"
        )));
    }

    if asset.binary_path.trim().is_empty() {
        return Err(UpdaterError::InvalidManifest(format!(
            "asset binary_path for target {target} is empty"
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_manifest_rejects_empty_assets() {
        let body = r#"{
          "version":"0.2.0",
          "published_at":"2026-04-01T12:00:00Z",
          "notes_url":"https://example.com/release",
          "assets":{}
        }"#;

        let error = parse_manifest(body).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidManifest(_)));
    }

    #[test]
    fn parse_manifest_accepts_valid_payload() {
        let body = r#"{
          "version":"0.2.0",
          "published_at":"2026-04-01T12:00:00Z",
          "notes_url":"https://example.com/release",
          "assets":{
            "x86_64-apple-darwin":{
              "url":"https://example.com/dsp-x86_64-apple-darwin.tar.gz",
              "sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "archive":"tar.gz",
              "binary_path":"dsp"
            }
          }
        }"#;

        let manifest = parse_manifest(body).unwrap();
        assert_eq!(manifest.version, "0.2.0");
    }

    #[test]
    fn parse_version_handles_leading_v() {
        assert_eq!(parse_version("v1.2.3").unwrap(), Version::new(1, 2, 3));
    }

    #[test]
    fn newer_version_detection_is_semver_aware() {
        let current = Version::new(1, 2, 9);
        let latest = Version::new(1, 10, 0);
        assert!(is_newer_version(&current, &latest));
    }

    #[test]
    fn resolve_target_matches_supported_combinations() {
        let expected = match (std::env::consts::OS, std::env::consts::ARCH) {
            ("macos", "x86_64") => Some("x86_64-apple-darwin"),
            ("macos", "aarch64") => Some("aarch64-apple-darwin"),
            ("linux", "x86_64") => Some("x86_64-unknown-linux-gnu"),
            ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
            _ => None,
        };

        match expected {
            Some(expected) => assert_eq!(resolve_target().unwrap(), expected),
            None => assert!(matches!(
                resolve_target().unwrap_err(),
                UpdaterError::UnsupportedPlatform(_)
            )),
        }
    }
}
