//! Asset management commands.

use crate::core::thumbnails;
use crate::models::{Asset, Dimensions};
use crate::utils::generate_id;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// In-memory storage for assets.
pub struct AssetStore {
    pub(crate) assets: Mutex<Vec<Asset>>,
}

impl AssetStore {
    pub fn new() -> Self {
        AssetStore {
            assets: Mutex::new(Vec::new()),
        }
    }
}

impl Default for AssetStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of thumbnail generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub thumbnail_path: String,
    pub dimensions: Dimensions,
}

/// Generates a thumbnail for an image file.
///
/// The thumbnail is resized to fit within `max_size x max_size` (default 256)
/// while maintaining aspect ratio.
#[tauri::command]
pub fn generate_thumbnail(
    input_path: String,
    output_path: String,
    max_size: Option<u32>,
) -> Result<ThumbnailResult, String> {
    let dimensions = thumbnails::generate_thumbnail(&input_path, &output_path, max_size)?;
    Ok(ThumbnailResult {
        thumbnail_path: output_path,
        dimensions,
    })
}

/// Imports a new asset into the project.
///
/// If the file is a supported image format and a `project_dir` is provided,
/// a thumbnail is automatically generated in the `.thumbnails` subdirectory.
#[tauri::command]
pub fn import_asset(
    name: String,
    file_path: String,
    project_dir: Option<String>,
    store: State<AssetStore>,
) -> Result<Asset, String> {
    use std::fs;

    // Get file metadata
    let metadata = fs::metadata(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let id = generate_id();
    let mime_type = thumbnails::detect_mime_type(&file_path);

    // Get image dimensions and generate thumbnail if the file is a supported image
    let is_image = thumbnails::is_supported_image(&file_path);

    let dimensions = if is_image {
        thumbnails::get_image_dimensions(&file_path).ok()
    } else {
        None
    };

    let thumbnail_path = if is_image {
        if let Some(ref proj_dir) = project_dir {
            let thumb_path = thumbnails::thumbnail_output_path(proj_dir, &id);
            match thumbnails::generate_thumbnail(&file_path, &thumb_path, None) {
                Ok(_) => Some(thumb_path),
                Err(e) => {
                    log::warn!("Failed to generate thumbnail for '{}': {}", file_path, e);
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    let asset = Asset {
        id,
        name,
        file_path,
        thumbnail_path,
        file_size: metadata.len(),
        mime_type,
        dimensions,
        created_at: Utc::now().to_rfc3339(),
    };

    store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .push(asset.clone());

    Ok(asset)
}

/// Lists all assets in the project.
#[tauri::command]
pub fn list_assets(store: State<AssetStore>) -> Result<Vec<Asset>, String> {
    let assets = store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(assets.clone())
}

/// Deletes an asset from the project.
#[tauri::command]
pub fn delete_asset(asset_id: String, store: State<AssetStore>) -> Result<(), String> {
    let mut assets = store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let pos = assets
        .iter()
        .position(|a| a.id == asset_id)
        .ok_or_else(|| format!("Asset not found: {}", asset_id))?;

    assets.remove(pos);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use std::fs::File;
    use std::io::Write;
    use std::path::Path;
    use tempfile::TempDir;

    fn create_test_file(dir: &TempDir, name: &str, content: &[u8]) -> String {
        let file_path = dir.path().join(name);
        let mut file = File::create(&file_path).unwrap();
        file.write_all(content).unwrap();
        file_path.to_str().unwrap().to_string()
    }

    fn create_test_image(dir: &TempDir, name: &str, width: u32, height: u32) -> String {
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_fn(width, height, |x, y| {
            Rgba([(x % 256) as u8, (y % 256) as u8, 128, 255])
        });
        let path = dir.path().join(name);
        img.save(&path).unwrap();
        path.to_str().unwrap().to_string()
    }

    // Helper functions for testing without tauri::State
    fn import_asset_internal(
        name: String,
        file_path: String,
        project_dir: Option<String>,
        store: &AssetStore,
    ) -> Result<Asset, String> {
        use std::fs;

        let metadata =
            fs::metadata(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

        let id = generate_id();
        let mime_type = thumbnails::detect_mime_type(&file_path);
        let is_image = thumbnails::is_supported_image(&file_path);

        let dimensions = if is_image {
            thumbnails::get_image_dimensions(&file_path).ok()
        } else {
            None
        };

        let thumbnail_path = if is_image {
            if let Some(ref proj_dir) = project_dir {
                let thumb_path = thumbnails::thumbnail_output_path(proj_dir, &id);
                match thumbnails::generate_thumbnail(&file_path, &thumb_path, None) {
                    Ok(_) => Some(thumb_path),
                    Err(e) => {
                        log::warn!("Failed to generate thumbnail for '{}': {}", file_path, e);
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        let asset = Asset {
            id,
            name,
            file_path,
            thumbnail_path,
            file_size: metadata.len(),
            mime_type,
            dimensions,
            created_at: Utc::now().to_rfc3339(),
        };

        store
            .assets
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?
            .push(asset.clone());

        Ok(asset)
    }

    fn list_assets_internal(store: &AssetStore) -> Result<Vec<Asset>, String> {
        let assets = store
            .assets
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        Ok(assets.clone())
    }

    fn delete_asset_internal(asset_id: String, store: &AssetStore) -> Result<(), String> {
        let mut assets = store
            .assets
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        let pos = assets
            .iter()
            .position(|a| a.id == asset_id)
            .ok_or_else(|| format!("Asset not found: {}", asset_id))?;

        assets.remove(pos);
        Ok(())
    }

    #[test]
    fn import_asset_returns_asset_with_id() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = create_test_file(&temp_dir, "test.txt", b"hello");

        let store = AssetStore::new();
        let result = import_asset_internal("test.txt".to_string(), file_path, None, &store);

        assert!(result.is_ok());
        let asset = result.unwrap();
        assert!(!asset.id.is_empty());
        assert_eq!(asset.name, "test.txt");
    }

    #[test]
    fn import_asset_sets_file_size() {
        let temp_dir = TempDir::new().unwrap();
        let content = b"hello world";
        let file_path = create_test_file(&temp_dir, "test.txt", content);

        let store = AssetStore::new();
        let result = import_asset_internal("test.txt".to_string(), file_path, None, &store);

        assert!(result.is_ok());
        let asset = result.unwrap();
        assert_eq!(asset.file_size, content.len() as u64);
    }

    #[test]
    fn import_asset_returns_error_for_missing_file() {
        let store = AssetStore::new();
        let result = import_asset_internal(
            "missing.txt".to_string(),
            "/nonexistent/path".to_string(),
            None,
            &store,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn import_asset_stores_in_state() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = create_test_file(&temp_dir, "test.txt", b"content");

        let store = AssetStore::new();
        import_asset_internal("test.txt".to_string(), file_path, None, &store).unwrap();

        let assets = store.assets.lock().unwrap();
        assert_eq!(assets.len(), 1);
    }

    #[test]
    fn import_image_asset_detects_mime_type() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "photo.png", 100, 100);

        let store = AssetStore::new();
        let asset =
            import_asset_internal("photo.png".to_string(), img_path, None, &store).unwrap();

        assert_eq!(asset.mime_type, "image/png");
    }

    #[test]
    fn import_image_asset_detects_dimensions() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "photo.png", 800, 600);

        let store = AssetStore::new();
        let asset =
            import_asset_internal("photo.png".to_string(), img_path, None, &store).unwrap();

        assert!(asset.dimensions.is_some());
        let dims = asset.dimensions.unwrap();
        assert_eq!(dims.width, 800);
        assert_eq!(dims.height, 600);
    }

    #[test]
    fn import_image_asset_generates_thumbnail_with_project_dir() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "photo.png", 1024, 768);
        let project_dir = temp_dir.path().to_str().unwrap().to_string();

        let store = AssetStore::new();
        let asset = import_asset_internal(
            "photo.png".to_string(),
            img_path,
            Some(project_dir),
            &store,
        )
        .unwrap();

        assert!(asset.thumbnail_path.is_some());
        let thumb_path = asset.thumbnail_path.unwrap();
        assert!(Path::new(&thumb_path).exists());
        assert!(thumb_path.contains(".thumbnails"));
    }

    #[test]
    fn import_image_asset_no_thumbnail_without_project_dir() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "photo.png", 400, 300);

        let store = AssetStore::new();
        let asset =
            import_asset_internal("photo.png".to_string(), img_path, None, &store).unwrap();

        assert!(asset.thumbnail_path.is_none());
    }

    #[test]
    fn import_non_image_asset_no_thumbnail() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = create_test_file(&temp_dir, "data.json", b"{}");
        let project_dir = temp_dir.path().to_str().unwrap().to_string();

        let store = AssetStore::new();
        let asset = import_asset_internal(
            "data.json".to_string(),
            file_path,
            Some(project_dir),
            &store,
        )
        .unwrap();

        assert!(asset.thumbnail_path.is_none());
        assert!(asset.dimensions.is_none());
    }

    #[test]
    fn list_assets_returns_empty_initially() {
        let store = AssetStore::new();
        let result = list_assets_internal(&store);

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn list_assets_returns_all_imported_assets() {
        let temp_dir = TempDir::new().unwrap();
        let file1 = create_test_file(&temp_dir, "file1.txt", b"content1");
        let file2 = create_test_file(&temp_dir, "file2.txt", b"content2");

        let store = AssetStore::new();
        import_asset_internal("file1.txt".to_string(), file1, None, &store).unwrap();
        import_asset_internal("file2.txt".to_string(), file2, None, &store).unwrap();

        let result = list_assets_internal(&store);
        assert!(result.is_ok());
        let assets = result.unwrap();
        assert_eq!(assets.len(), 2);
    }

    #[test]
    fn delete_asset_removes_asset() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = create_test_file(&temp_dir, "test.txt", b"content");

        let store = AssetStore::new();
        let asset =
            import_asset_internal("test.txt".to_string(), file_path, None, &store).unwrap();

        let result = delete_asset_internal(asset.id, &store);
        assert!(result.is_ok());

        let assets = list_assets_internal(&store).unwrap();
        assert_eq!(assets.len(), 0);
    }

    #[test]
    fn delete_asset_returns_error_for_nonexistent_asset() {
        let store = AssetStore::new();
        let result = delete_asset_internal("nonexistent".to_string(), &store);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn delete_asset_only_removes_specified_asset() {
        let temp_dir = TempDir::new().unwrap();
        let file1 = create_test_file(&temp_dir, "file1.txt", b"content1");
        let file2 = create_test_file(&temp_dir, "file2.txt", b"content2");

        let store = AssetStore::new();
        let asset1 =
            import_asset_internal("file1.txt".to_string(), file1, None, &store).unwrap();
        import_asset_internal("file2.txt".to_string(), file2, None, &store).unwrap();

        delete_asset_internal(asset1.id, &store).unwrap();

        let assets = list_assets_internal(&store).unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "file2.txt");
    }
}
