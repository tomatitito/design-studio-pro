use crate::updater::types::{ArchiveFormat, InstallOutcome, PreparedUpdate, UpdaterError};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
use tempfile::TempDir;

pub async fn install_prepared_update(
    client: &reqwest::Client,
    prepared: &PreparedUpdate,
) -> Result<InstallOutcome, UpdaterError> {
    if !prepared.official_install {
        return Err(UpdaterError::UnsupportedInstallPath {
            current_exe: prepared.current_exe.clone(),
            expected_root: prepared.install_root.clone(),
        });
    }

    let temp_dir = tempfile::tempdir()?;
    let archive_path = download_archive(client, prepared, &temp_dir).await?;
    let extracted_binary = extract_binary(prepared, &archive_path, &temp_dir)?;

    #[cfg(unix)]
    ensure_executable(&extracted_binary)?;

    replace_binary(prepared, &extracted_binary)
}

pub async fn download_archive(
    client: &reqwest::Client,
    prepared: &PreparedUpdate,
    temp_dir: &TempDir,
) -> Result<PathBuf, UpdaterError> {
    let response = client.get(&prepared.asset.url).send().await?;
    let status = response.status();
    if !status.is_success() {
        return Err(UpdaterError::HttpStatus(status));
    }

    let bytes = response.bytes().await?;
    verify_sha256(bytes.as_ref(), &prepared.asset.sha256)?;

    let extension = match prepared.asset.archive {
        ArchiveFormat::TarGz => "tar.gz",
        ArchiveFormat::Zip => "zip",
    };
    let archive_path = temp_dir.path().join(format!("dsp-update.{extension}"));
    fs::write(&archive_path, &bytes)?;

    Ok(archive_path)
}

pub fn verify_sha256(bytes: &[u8], expected_sha256: &str) -> Result<(), UpdaterError> {
    let digest = Sha256::digest(bytes);
    let actual = hex_encode(digest.as_slice());
    if actual.eq_ignore_ascii_case(expected_sha256) {
        return Ok(());
    }

    Err(UpdaterError::ChecksumMismatch {
        expected: expected_sha256.to_string(),
        actual,
    })
}

pub fn extract_binary(
    prepared: &PreparedUpdate,
    archive_path: &Path,
    temp_dir: &TempDir,
) -> Result<PathBuf, UpdaterError> {
    let extraction_root = temp_dir.path().join("extract");
    fs::create_dir_all(&extraction_root)?;

    match prepared.asset.archive {
        ArchiveFormat::TarGz => extract_tar_gz(archive_path, &extraction_root)?,
        ArchiveFormat::Zip => extract_zip(archive_path, &extraction_root)?,
    }

    let binary_path = extraction_root.join(&prepared.asset.binary_path);
    if binary_path.is_file() {
        return Ok(binary_path);
    }

    Err(UpdaterError::InvalidArchive(format!(
        "expected binary {} was not found in the downloaded archive",
        prepared.asset.binary_path
    )))
}

fn extract_tar_gz(archive_path: &Path, extraction_root: &Path) -> Result<(), UpdaterError> {
    let bytes = fs::read(archive_path)?;
    let decoder = flate2::read::GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(extraction_root)?;
    Ok(())
}

fn extract_zip(archive_path: &Path, extraction_root: &Path) -> Result<(), UpdaterError> {
    let file = fs::File::open(archive_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        UpdaterError::InvalidArchive(format!("failed to open zip archive: {error}"))
    })?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| {
            UpdaterError::InvalidArchive(format!("failed to read zip entry #{index}: {error}"))
        })?;
        let Some(name) = file.enclosed_name().map(|path| path.to_owned()) else {
            continue;
        };

        let output_path = extraction_root.join(name);
        if file.is_dir() {
            fs::create_dir_all(&output_path)?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut output = fs::File::create(&output_path)?;
        std::io::copy(&mut file, &mut output)?;
    }

    Ok(())
}

#[cfg(unix)]
fn ensure_executable(path: &Path) -> Result<(), UpdaterError> {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(path)?;
    let mut permissions = metadata.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

fn replace_binary(
    prepared: &PreparedUpdate,
    extracted_binary: &Path,
) -> Result<InstallOutcome, UpdaterError> {
    #[cfg(windows)]
    {
        return stage_windows_replacement(prepared, extracted_binary);
    }

    #[cfg(not(windows))]
    {
        replace_binary_unix(prepared, extracted_binary)
    }
}

#[cfg(not(windows))]
fn replace_binary_unix(
    prepared: &PreparedUpdate,
    extracted_binary: &Path,
) -> Result<InstallOutcome, UpdaterError> {
    let backup_path = prepared.current_exe.with_extension("bak");
    if backup_path.exists() {
        fs::remove_file(&backup_path)?;
    }

    fs::rename(&prepared.current_exe, &backup_path)?;
    match fs::rename(extracted_binary, &prepared.current_exe) {
        Ok(()) => {
            let _ = fs::remove_file(&backup_path);
            Ok(InstallOutcome::Installed {
                previous_version: prepared.current_version.to_string(),
                new_version: prepared.latest_version.to_string(),
            })
        }
        Err(error) => {
            let _ = fs::rename(&backup_path, &prepared.current_exe);
            Err(UpdaterError::Io(error))
        }
    }
}

#[cfg(windows)]
fn stage_windows_replacement(
    prepared: &PreparedUpdate,
    extracted_binary: &Path,
) -> Result<InstallOutcome, UpdaterError> {
    let staging_dir = extracted_binary.parent().ok_or_else(|| {
        UpdaterError::InvalidArchive(
            "extracted binary does not have a parent directory".to_string(),
        )
    })?;
    let script_path = staging_dir.join("replace-dsp.ps1");
    let backup_path = prepared.current_exe.with_extension("old.exe");
    let current_pid = std::process::id();

    let script = format!(
        r#"$ErrorActionPreference = "Stop"
$pidToWait = {current_pid}
$source = "{source}"
$target = "{target}"
$backup = "{backup}"

for ($i = 0; $i -lt 100; $i++) {{
  if (-not (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue)) {{
    break
  }}
  Start-Sleep -Milliseconds 200
}}

if (Test-Path $backup) {{
  Remove-Item -Force $backup
}}
if (Test-Path $target) {{
  Move-Item -Force $target $backup
}}
Move-Item -Force $source $target
if (Test-Path $backup) {{
  Remove-Item -Force $backup
}}
Remove-Item -Force $MyInvocation.MyCommand.Path
"#,
        source = powershell_literal(extracted_binary),
        target = powershell_literal(&prepared.current_exe),
        backup = powershell_literal(&backup_path),
    );

    fs::write(&script_path, script)?;

    Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script_path)
        .spawn()?;

    Ok(InstallOutcome::StagedWindowsReplacement {
        previous_version: prepared.current_version.to_string(),
        new_version: prepared.latest_version.to_string(),
    })
}

#[cfg(windows)]
fn powershell_literal(path: &Path) -> String {
    path.display().to_string().replace('\'', "''")
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::updater::types::{ArchiveFormat, PreparedUpdate, UpdateAsset, UpdateManifest};
    use chrono::Utc;
    use semver::Version;
    use std::collections::BTreeMap;

    #[test]
    fn verify_sha256_accepts_matching_digest() {
        let bytes = b"design-studio-pro";
        let digest = Sha256::digest(bytes);
        verify_sha256(bytes, &hex_encode(digest.as_slice())).unwrap();
    }

    #[test]
    fn verify_sha256_rejects_mismatch() {
        let error = verify_sha256(b"abc", "00").unwrap_err();
        assert!(matches!(error, UpdaterError::ChecksumMismatch { .. }));
    }

    #[test]
    fn extract_binary_reports_missing_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let archive_path = temp_dir.path().join("missing.zip");
        fs::write(&archive_path, []).unwrap();

        let prepared = sample_prepared_update(ArchiveFormat::Zip, "dsp");
        let error = extract_binary(&prepared, &archive_path, &temp_dir).unwrap_err();
        assert!(matches!(error, UpdaterError::InvalidArchive(_)));
    }

    fn sample_prepared_update(archive: ArchiveFormat, binary_path: &str) -> PreparedUpdate {
        PreparedUpdate {
            current_version: Version::new(0, 1, 0),
            latest_version: Version::new(0, 2, 0),
            manifest: UpdateManifest {
                version: "0.2.0".to_string(),
                published_at: Utc::now(),
                notes_url: "https://example.com/release".to_string(),
                assets: BTreeMap::new(),
            },
            asset_target: "x86_64-unknown-linux-gnu".to_string(),
            asset: UpdateAsset {
                url: "https://example.com/dsp.tar.gz".to_string(),
                sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_string(),
                archive,
                binary_path: binary_path.to_string(),
            },
            official_install: true,
            current_exe: PathBuf::from("/tmp/dsp"),
            install_root: PathBuf::from("/tmp"),
        }
    }
}
