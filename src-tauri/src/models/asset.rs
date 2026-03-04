//! Asset model for media files.

use serde::{Deserialize, Serialize};

/// Dimensions for image assets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Dimensions {
    pub width: u32,
    pub height: u32,
}

/// A media asset (image, etc.) used in the project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub file_size: u64,
    pub mime_type: String,
    pub dimensions: Option<Dimensions>,
    pub created_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dimensions_can_be_created() {
        let dims = Dimensions {
            width: 1920,
            height: 1080,
        };

        assert_eq!(dims.width, 1920);
        assert_eq!(dims.height, 1080);
    }

    #[test]
    fn asset_can_be_created_with_dimensions() {
        let asset = Asset {
            id: "asset1".to_string(),
            name: "photo.jpg".to_string(),
            file_path: "/path/to/photo.jpg".to_string(),
            thumbnail_path: Some("/path/to/thumb.jpg".to_string()),
            file_size: 1024000,
            mime_type: "image/jpeg".to_string(),
            dimensions: Some(Dimensions {
                width: 1920,
                height: 1080,
            }),
            created_at: "2026-02-24T10:00:00Z".to_string(),
        };

        assert_eq!(asset.id, "asset1");
        assert_eq!(asset.name, "photo.jpg");
        assert!(asset.dimensions.is_some());
    }

    #[test]
    fn asset_can_be_created_without_dimensions() {
        let asset = Asset {
            id: "asset2".to_string(),
            name: "document.pdf".to_string(),
            file_path: "/path/to/document.pdf".to_string(),
            thumbnail_path: None,
            file_size: 512000,
            mime_type: "application/pdf".to_string(),
            dimensions: None,
            created_at: "2026-02-24T10:00:00Z".to_string(),
        };

        assert_eq!(asset.mime_type, "application/pdf");
        assert!(asset.dimensions.is_none());
        assert!(asset.thumbnail_path.is_none());
    }

    #[test]
    fn asset_serializes_to_json() {
        let asset = Asset {
            id: "asset1".to_string(),
            name: "test.png".to_string(),
            file_path: "/test.png".to_string(),
            thumbnail_path: None,
            file_size: 2048,
            mime_type: "image/png".to_string(),
            dimensions: Some(Dimensions {
                width: 800,
                height: 600,
            }),
            created_at: "2026-02-24T10:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&asset).unwrap();
        assert!(json.contains("\"id\":\"asset1\""));
        assert!(json.contains("\"mimeType\":\"image/png\""));
        assert!(json.contains("\"width\":800"));
    }
}
