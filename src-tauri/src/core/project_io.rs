//! Project save/load with .dsproj format.
//!
//! The .dsproj format is a ZIP archive containing:
//! - manifest.json: project metadata, pages, elements, and asset references
//! - assets/: original asset files
//! - thumbnails/: generated thumbnail files

use crate::models::{Asset, Project};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use zip::write::FileOptions;
use zip::CompressionMethod;

/// Version of the .dsproj format.
pub const FORMAT_VERSION: &str = "1.0";

/// The manifest stored inside a .dsproj archive.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    /// Format version for forward compatibility.
    pub version: String,
    /// The project data (metadata, pages, elements, settings).
    pub project: Project,
    /// Asset references included in this archive.
    pub assets: Vec<Asset>,
}

/// Saves a project and its assets to a .dsproj ZIP archive.
///
/// The archive structure is:
/// ```text
/// project.dsproj (ZIP)
/// +-- manifest.json
/// +-- assets/
/// |   +-- image1.png
/// |   +-- image2.jpg
/// +-- thumbnails/
///     +-- asset1_thumb.png
///     +-- asset2_thumb.png
/// ```
pub fn save_project(
    output_path: &str,
    project: &Project,
    assets: &[Asset],
) -> Result<(), String> {
    let file = fs::File::create(output_path)
        .map_err(|e| format!("Failed to create file '{}': {}", output_path, e))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::<()>::default().compression_method(CompressionMethod::Deflated);

    // Write manifest.json
    let manifest = ProjectManifest {
        version: FORMAT_VERSION.to_string(),
        project: project.clone(),
        assets: assets.to_vec(),
    };

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to write manifest entry: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest data: {}", e))?;

    // Write asset files
    for asset in assets {
        let asset_path = Path::new(&asset.file_path);
        if asset_path.exists() {
            let file_name = asset_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&asset.id);

            let archive_path = format!("assets/{}", file_name);

            zip.start_file(&archive_path, options)
                .map_err(|e| format!("Failed to write asset entry '{}': {}", archive_path, e))?;

            let data = fs::read(&asset.file_path)
                .map_err(|e| format!("Failed to read asset '{}': {}", asset.file_path, e))?;

            zip.write_all(&data)
                .map_err(|e| format!("Failed to write asset data '{}': {}", archive_path, e))?;
        }

        // Write thumbnail if present
        if let Some(ref thumb_path) = asset.thumbnail_path {
            let thumb_file = Path::new(thumb_path);
            if thumb_file.exists() {
                let thumb_name = thumb_file
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("thumb.png");

                let archive_path = format!("thumbnails/{}", thumb_name);

                zip.start_file(&archive_path, options)
                    .map_err(|e| {
                        format!("Failed to write thumbnail entry '{}': {}", archive_path, e)
                    })?;

                let data = fs::read(thumb_path)
                    .map_err(|e| format!("Failed to read thumbnail '{}': {}", thumb_path, e))?;

                zip.write_all(&data).map_err(|e| {
                    format!("Failed to write thumbnail data '{}': {}", archive_path, e)
                })?;
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize archive: {}", e))?;

    Ok(())
}

/// Result of loading a project from a .dsproj archive.
#[derive(Debug, Clone)]
pub struct LoadedProject {
    /// The project manifest data.
    pub manifest: ProjectManifest,
    /// Directory where extracted assets were placed.
    pub extract_dir: String,
}

/// Loads a project from a .dsproj ZIP archive.
///
/// Extracts assets and thumbnails into subdirectories under `extract_dir`.
/// The asset paths in the returned manifest are updated to point to the
/// extracted files.
pub fn load_project(
    archive_path: &str,
    extract_dir: &str,
) -> Result<LoadedProject, String> {
    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive '{}': {}", archive_path, e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read archive '{}': {}", archive_path, e))?;

    // Create extraction directories
    let assets_dir = Path::new(extract_dir).join("assets");
    let thumbnails_dir = Path::new(extract_dir).join(".thumbnails");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    fs::create_dir_all(&thumbnails_dir)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;

    // Read manifest
    let manifest: ProjectManifest = {
        let mut manifest_file = archive.by_name("manifest.json").map_err(|e| {
            format!("Failed to find manifest.json in archive: {}", e)
        })?;

        let mut manifest_content = String::new();
        manifest_file
            .read_to_string(&mut manifest_content)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;

        serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest.json: {}", e))?
    };

    // Extract all files (assets and thumbnails)
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        let entry_name = entry.name().to_string();

        if entry_name == "manifest.json" {
            continue;
        }

        let out_path = if entry_name.starts_with("assets/") {
            let file_name = entry_name.strip_prefix("assets/").unwrap_or(&entry_name);
            if file_name.is_empty() {
                continue;
            }
            assets_dir.join(file_name)
        } else if entry_name.starts_with("thumbnails/") {
            let file_name = entry_name.strip_prefix("thumbnails/").unwrap_or(&entry_name);
            if file_name.is_empty() {
                continue;
            }
            thumbnails_dir.join(file_name)
        } else {
            continue;
        };

        let mut data = Vec::new();
        entry
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to read entry '{}': {}", entry_name, e))?;

        fs::write(&out_path, &data)
            .map_err(|e| format!("Failed to extract '{}': {}", entry_name, e))?;
    }

    // Update asset paths to point to extracted locations
    let mut updated_manifest = manifest;
    for asset in &mut updated_manifest.assets {
        let file_name = Path::new(&asset.file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&asset.id);

        let extracted_path = assets_dir.join(file_name);
        if extracted_path.exists() {
            asset.file_path = extracted_path.to_string_lossy().to_string();
        }

        if let Some(ref thumb_path) = asset.thumbnail_path {
            let thumb_name = Path::new(thumb_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("thumb.png");

            let extracted_thumb = thumbnails_dir.join(thumb_name);
            if extracted_thumb.exists() {
                asset.thumbnail_path = Some(extracted_thumb.to_string_lossy().to_string());
            }
        }
    }

    Ok(LoadedProject {
        manifest: updated_manifest,
        extract_dir: extract_dir.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Dimensions, MeasurementUnit, Orientation, Page, ProjectSettings,
    };
    use image::{ImageBuffer, Rgba};
    use tempfile::TempDir;

    fn create_test_project() -> Project {
        Project {
            id: "proj-test-001".to_string(),
            name: "Test Project".to_string(),
            pages: vec![Page {
                id: "page1".to_string(),
                name: "Main Page".to_string(),
                elements: vec![],
                width: 1920.0,
                height: 1080.0,
                background_color: "#FFFFFF".to_string(),
                order: 0,
            }],
            created_at: "2026-02-24T10:00:00Z".to_string(),
            modified_at: "2026-02-24T12:00:00Z".to_string(),
            settings: ProjectSettings {
                width: 1920.0,
                height: 1080.0,
                orientation: Orientation::Landscape,
                unit: MeasurementUnit::Px,
            },
        }
    }

    fn create_test_image(dir: &TempDir, name: &str, width: u32, height: u32) -> String {
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_fn(width, height, |x, y| {
                Rgba([(x % 256) as u8, (y % 256) as u8, 128, 255])
            });
        let path = dir.path().join(name);
        img.save(&path).unwrap();
        path.to_str().unwrap().to_string()
    }

    fn create_test_asset(dir: &TempDir) -> Asset {
        let img_path = create_test_image(dir, "photo.png", 800, 600);
        let thumb_path = create_test_image(dir, "photo_thumb.png", 256, 192);

        Asset {
            id: "asset-001".to_string(),
            name: "photo.png".to_string(),
            file_path: img_path,
            thumbnail_path: Some(thumb_path),
            file_size: 1024,
            mime_type: "image/png".to_string(),
            dimensions: Some(Dimensions {
                width: 800,
                height: 600,
            }),
            created_at: "2026-02-24T10:00:00Z".to_string(),
        }
    }

    #[test]
    fn save_project_creates_file() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();

        let result = save_project(
            output_path.to_str().unwrap(),
            &project,
            &[],
        );

        assert!(result.is_ok());
        assert!(output_path.exists());
    }

    #[test]
    fn save_project_creates_valid_zip() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();

        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        // Verify it's a valid ZIP
        let file = fs::File::open(&output_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();
        assert!(archive.len() >= 1); // At least manifest.json
    }

    #[test]
    fn save_project_includes_manifest() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();

        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        let file = fs::File::open(&output_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let manifest_entry = archive.by_name("manifest.json");
        assert!(manifest_entry.is_ok());
    }

    #[test]
    fn save_project_manifest_contains_project_data() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();

        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        let file = fs::File::open(&output_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut manifest_file = archive.by_name("manifest.json").unwrap();

        let mut content = String::new();
        manifest_file.read_to_string(&mut content).unwrap();

        let manifest: ProjectManifest = serde_json::from_str(&content).unwrap();
        assert_eq!(manifest.version, FORMAT_VERSION);
        assert_eq!(manifest.project.id, "proj-test-001");
        assert_eq!(manifest.project.name, "Test Project");
    }

    #[test]
    fn save_project_includes_assets() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();
        let asset = create_test_asset(&temp_dir);

        save_project(
            output_path.to_str().unwrap(),
            &project,
            &[asset],
        )
        .unwrap();

        let file = fs::File::open(&output_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();

        // Should have manifest + asset + thumbnail
        assert!(archive.by_name("assets/photo.png").is_ok());
        assert!(archive.by_name("thumbnails/photo_thumb.png").is_ok());
    }

    #[test]
    fn save_project_skips_missing_asset_files() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let project = create_test_project();

        let missing_asset = Asset {
            id: "asset-missing".to_string(),
            name: "missing.png".to_string(),
            file_path: "/nonexistent/missing.png".to_string(),
            thumbnail_path: None,
            file_size: 0,
            mime_type: "image/png".to_string(),
            dimensions: None,
            created_at: "2026-02-24T10:00:00Z".to_string(),
        };

        let result = save_project(
            output_path.to_str().unwrap(),
            &project,
            &[missing_asset],
        );

        // Should succeed - missing files are skipped
        assert!(result.is_ok());
    }

    #[test]
    fn load_project_reads_manifest() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let extract_dir = temp_dir.path().join("extracted");
        fs::create_dir_all(&extract_dir).unwrap();

        let project = create_test_project();
        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(loaded.manifest.version, FORMAT_VERSION);
        assert_eq!(loaded.manifest.project.id, "proj-test-001");
        assert_eq!(loaded.manifest.project.name, "Test Project");
        assert_eq!(loaded.manifest.project.pages.len(), 1);
    }

    #[test]
    fn save_load_roundtrip_preserves_project() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("roundtrip.dsproj");
        let extract_dir = temp_dir.path().join("extracted");

        let project = create_test_project();
        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(loaded.manifest.project.id, project.id);
        assert_eq!(loaded.manifest.project.name, project.name);
        assert_eq!(loaded.manifest.project.pages.len(), project.pages.len());
        assert_eq!(loaded.manifest.project.settings, project.settings);
        assert_eq!(loaded.manifest.project.created_at, project.created_at);
        assert_eq!(loaded.manifest.project.modified_at, project.modified_at);
    }

    #[test]
    fn save_load_roundtrip_preserves_assets() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("roundtrip.dsproj");
        let extract_dir = temp_dir.path().join("extracted");

        let project = create_test_project();
        let asset = create_test_asset(&temp_dir);

        save_project(
            output_path.to_str().unwrap(),
            &project,
            &[asset.clone()],
        )
        .unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(loaded.manifest.assets.len(), 1);
        let loaded_asset = &loaded.manifest.assets[0];
        assert_eq!(loaded_asset.id, asset.id);
        assert_eq!(loaded_asset.name, asset.name);
        assert_eq!(loaded_asset.mime_type, asset.mime_type);
        assert_eq!(loaded_asset.dimensions, asset.dimensions);
    }

    #[test]
    fn load_project_extracts_asset_files() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let extract_dir = temp_dir.path().join("extracted");

        let project = create_test_project();
        let asset = create_test_asset(&temp_dir);

        save_project(
            output_path.to_str().unwrap(),
            &project,
            &[asset],
        )
        .unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        // Verify asset file was extracted
        let loaded_asset = &loaded.manifest.assets[0];
        assert!(Path::new(&loaded_asset.file_path).exists());

        // Verify thumbnail was extracted
        assert!(loaded_asset.thumbnail_path.is_some());
        assert!(Path::new(loaded_asset.thumbnail_path.as_ref().unwrap()).exists());
    }

    #[test]
    fn load_project_updates_asset_paths() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let extract_dir = temp_dir.path().join("extracted");

        let project = create_test_project();
        let asset = create_test_asset(&temp_dir);

        save_project(
            output_path.to_str().unwrap(),
            &project,
            &[asset.clone()],
        )
        .unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        let loaded_asset = &loaded.manifest.assets[0];
        // Paths should be updated to point to extracted location
        assert!(loaded_asset.file_path.contains("extracted"));
        assert_ne!(loaded_asset.file_path, asset.file_path);
    }

    #[test]
    fn load_project_creates_extraction_directories() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.dsproj");
        let extract_dir = temp_dir.path().join("new_extract");

        let project = create_test_project();
        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        assert!(extract_dir.join("assets").exists());
        assert!(extract_dir.join(".thumbnails").exists());
    }

    #[test]
    fn load_project_fails_for_missing_archive() {
        let result = load_project("/nonexistent/project.dsproj", "/tmp/extract");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open archive"));
    }

    #[test]
    fn load_project_fails_for_invalid_archive() {
        let temp_dir = TempDir::new().unwrap();
        let invalid_path = temp_dir.path().join("invalid.dsproj");
        fs::write(&invalid_path, "not a zip file").unwrap();

        let result = load_project(
            invalid_path.to_str().unwrap(),
            temp_dir.path().join("extract").to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read archive"));
    }

    #[test]
    fn save_project_with_multiple_assets() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("multi.dsproj");
        let project = create_test_project();

        let img1_path = create_test_image(&temp_dir, "image1.png", 200, 200);
        let img2_path = create_test_image(&temp_dir, "image2.png", 300, 300);

        let assets = vec![
            Asset {
                id: "asset-1".to_string(),
                name: "image1.png".to_string(),
                file_path: img1_path,
                thumbnail_path: None,
                file_size: 1000,
                mime_type: "image/png".to_string(),
                dimensions: Some(Dimensions { width: 200, height: 200 }),
                created_at: "2026-02-24T10:00:00Z".to_string(),
            },
            Asset {
                id: "asset-2".to_string(),
                name: "image2.png".to_string(),
                file_path: img2_path,
                thumbnail_path: None,
                file_size: 2000,
                mime_type: "image/png".to_string(),
                dimensions: Some(Dimensions { width: 300, height: 300 }),
                created_at: "2026-02-24T10:00:00Z".to_string(),
            },
        ];

        save_project(output_path.to_str().unwrap(), &project, &assets).unwrap();

        let file = fs::File::open(&output_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();

        assert!(archive.by_name("assets/image1.png").is_ok());
        assert!(archive.by_name("assets/image2.png").is_ok());
    }

    #[test]
    fn save_load_roundtrip_with_multiple_assets() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("multi.dsproj");
        let extract_dir = temp_dir.path().join("extracted");
        let project = create_test_project();

        let img1_path = create_test_image(&temp_dir, "img1.png", 100, 100);
        let img2_path = create_test_image(&temp_dir, "img2.png", 200, 200);

        let assets = vec![
            Asset {
                id: "a1".to_string(),
                name: "img1.png".to_string(),
                file_path: img1_path,
                thumbnail_path: None,
                file_size: 500,
                mime_type: "image/png".to_string(),
                dimensions: Some(Dimensions { width: 100, height: 100 }),
                created_at: "2026-02-24T10:00:00Z".to_string(),
            },
            Asset {
                id: "a2".to_string(),
                name: "img2.png".to_string(),
                file_path: img2_path,
                thumbnail_path: None,
                file_size: 800,
                mime_type: "image/png".to_string(),
                dimensions: Some(Dimensions { width: 200, height: 200 }),
                created_at: "2026-02-24T10:00:00Z".to_string(),
            },
        ];

        save_project(output_path.to_str().unwrap(), &project, &assets).unwrap();

        let loaded = load_project(
            output_path.to_str().unwrap(),
            extract_dir.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(loaded.manifest.assets.len(), 2);
        assert!(Path::new(&loaded.manifest.assets[0].file_path).exists());
        assert!(Path::new(&loaded.manifest.assets[1].file_path).exists());
    }

    #[test]
    fn manifest_serialization_roundtrip() {
        let project = create_test_project();
        let manifest = ProjectManifest {
            version: FORMAT_VERSION.to_string(),
            project,
            assets: vec![],
        };

        let json = serde_json::to_string_pretty(&manifest).unwrap();
        let deserialized: ProjectManifest = serde_json::from_str(&json).unwrap();

        assert_eq!(manifest, deserialized);
    }

    #[test]
    fn save_project_fails_for_invalid_path() {
        let project = create_test_project();
        let result = save_project("/nonexistent/dir/test.dsproj", &project, &[]);
        assert!(result.is_err());
    }

    #[test]
    fn save_project_with_no_assets_creates_minimal_archive() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("minimal.dsproj");
        let project = create_test_project();

        save_project(output_path.to_str().unwrap(), &project, &[]).unwrap();

        let file = fs::File::open(&output_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();

        // Should only have manifest.json
        assert_eq!(archive.len(), 1);
    }
}
