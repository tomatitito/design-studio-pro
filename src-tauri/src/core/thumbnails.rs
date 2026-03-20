//! Thumbnail generation for image assets.
//!
//! Provides functions for generating thumbnails from image files,
//! maintaining aspect ratio while fitting within a maximum size.

use crate::models::Dimensions;
use image::ImageReader;
use std::path::Path;

/// Default maximum dimension (width or height) for generated thumbnails.
pub const DEFAULT_MAX_SIZE: u32 = 256;

/// Supported image MIME types for thumbnail generation.
const SUPPORTED_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif"];

/// Returns whether the given file extension is a supported image format.
pub fn is_supported_image(file_path: &str) -> bool {
    let path = Path::new(file_path);
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Detects the MIME type from a file extension.
pub fn detect_mime_type(file_path: &str) -> String {
    let path = Path::new(file_path);
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png".to_string(),
        Some("jpg" | "jpeg") => "image/jpeg".to_string(),
        Some("webp") => "image/webp".to_string(),
        Some("bmp") => "image/bmp".to_string(),
        Some("tiff" | "tif") => "image/tiff".to_string(),
        Some("gif") => "image/gif".to_string(),
        Some("svg") => "image/svg+xml".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

/// Gets the dimensions of an image without loading it fully into memory.
pub fn get_image_dimensions(input_path: &str) -> Result<Dimensions, String> {
    let reader = ImageReader::open(input_path)
        .map_err(|e| format!("Failed to open image '{}': {}", input_path, e))?;

    let reader = reader
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess image format: {}", e))?;

    let dims = reader
        .into_dimensions()
        .map_err(|e| format!("Failed to read image dimensions: {}", e))?;

    Ok(Dimensions {
        width: dims.0,
        height: dims.1,
    })
}

/// Generates a thumbnail for the given image.
///
/// Resizes the image to fit within `max_size x max_size` while maintaining
/// aspect ratio. The thumbnail is saved as PNG to the `output_path`.
///
/// Returns the dimensions of the generated thumbnail.
pub fn generate_thumbnail(
    input_path: &str,
    output_path: &str,
    max_size: Option<u32>,
) -> Result<Dimensions, String> {
    let max = max_size.unwrap_or(DEFAULT_MAX_SIZE);

    // Open and decode the image
    let img = ImageReader::open(input_path)
        .map_err(|e| format!("Failed to open image '{}': {}", input_path, e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess image format: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image '{}': {}", input_path, e))?;

    // Only resize if the image is larger than max_size; don't upscale small images
    let (orig_width, orig_height) = (img.width(), img.height());
    let thumbnail = if orig_width > max || orig_height > max {
        img.thumbnail(max, max)
    } else {
        img
    };

    let thumb_width = thumbnail.width();
    let thumb_height = thumbnail.height();

    // Ensure output directory exists
    if let Some(parent) = Path::new(output_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create thumbnail directory: {}", e))?;
    }

    // Save the thumbnail
    thumbnail
        .save(output_path)
        .map_err(|e| format!("Failed to save thumbnail '{}': {}", output_path, e))?;

    Ok(Dimensions {
        width: thumb_width,
        height: thumb_height,
    })
}

/// Constructs the thumbnail output path for a given asset.
///
/// Places thumbnails in a `.thumbnails` subdirectory relative to the
/// provided `project_dir`, using the asset ID as the filename.
pub fn thumbnail_output_path(project_dir: &str, asset_id: &str) -> String {
    let thumb_dir = Path::new(project_dir).join(".thumbnails");
    thumb_dir
        .join(format!("{}_thumb.png", asset_id))
        .to_string_lossy()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use std::fs;
    use tempfile::TempDir;

    /// Creates a test PNG image with the given dimensions.
    fn create_test_image(dir: &TempDir, name: &str, width: u32, height: u32) -> String {
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_fn(width, height, |x, y| {
            Rgba([(x % 256) as u8, (y % 256) as u8, 128, 255])
        });
        let path = dir.path().join(name);
        img.save(&path).unwrap();
        path.to_str().unwrap().to_string()
    }

    /// Creates a test JPEG image with the given dimensions.
    fn create_test_jpeg(dir: &TempDir, name: &str, width: u32, height: u32) -> String {
        use image::Rgb;
        let img: ImageBuffer<Rgb<u8>, Vec<u8>> =
            ImageBuffer::from_fn(width, height, |_, _| Rgb([200, 100, 50]));
        let path = dir.path().join(name);
        img.save(&path).unwrap();
        path.to_str().unwrap().to_string()
    }

    #[test]
    fn is_supported_image_recognizes_png() {
        assert!(is_supported_image("photo.png"));
        assert!(is_supported_image("photo.PNG"));
    }

    #[test]
    fn is_supported_image_recognizes_jpeg() {
        assert!(is_supported_image("photo.jpg"));
        assert!(is_supported_image("photo.jpeg"));
        assert!(is_supported_image("photo.JPEG"));
    }

    #[test]
    fn is_supported_image_recognizes_webp() {
        assert!(is_supported_image("photo.webp"));
    }

    #[test]
    fn is_supported_image_recognizes_bmp() {
        assert!(is_supported_image("photo.bmp"));
    }

    #[test]
    fn is_supported_image_recognizes_tiff() {
        assert!(is_supported_image("photo.tiff"));
        assert!(is_supported_image("photo.tif"));
    }

    #[test]
    fn is_supported_image_recognizes_gif() {
        assert!(is_supported_image("photo.gif"));
    }

    #[test]
    fn is_supported_image_rejects_unsupported_formats() {
        assert!(!is_supported_image("document.pdf"));
        assert!(!is_supported_image("data.json"));
        assert!(!is_supported_image("script.js"));
        assert!(!is_supported_image("noext"));
    }

    #[test]
    fn detect_mime_type_returns_correct_types() {
        assert_eq!(detect_mime_type("test.png"), "image/png");
        assert_eq!(detect_mime_type("test.jpg"), "image/jpeg");
        assert_eq!(detect_mime_type("test.jpeg"), "image/jpeg");
        assert_eq!(detect_mime_type("test.webp"), "image/webp");
        assert_eq!(detect_mime_type("test.bmp"), "image/bmp");
        assert_eq!(detect_mime_type("test.tiff"), "image/tiff");
        assert_eq!(detect_mime_type("test.gif"), "image/gif");
        assert_eq!(detect_mime_type("test.svg"), "image/svg+xml");
        assert_eq!(detect_mime_type("test.unknown"), "application/octet-stream");
    }

    #[test]
    fn get_image_dimensions_returns_correct_size() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "test.png", 800, 600);

        let dims = get_image_dimensions(&img_path).unwrap();

        assert_eq!(dims.width, 800);
        assert_eq!(dims.height, 600);
    }

    #[test]
    fn get_image_dimensions_fails_for_missing_file() {
        let result = get_image_dimensions("/nonexistent/path.png");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open image"));
    }

    #[test]
    fn generate_thumbnail_creates_file() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "source.png", 1024, 768);
        let thumb_path = temp_dir
            .path()
            .join("thumbs")
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let result = generate_thumbnail(&img_path, &thumb_path, None);

        assert!(result.is_ok());
        assert!(Path::new(&thumb_path).exists());
    }

    #[test]
    fn generate_thumbnail_maintains_aspect_ratio_landscape() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "wide.png", 1000, 500);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(256)).unwrap();

        // Width should be 256, height should be 128 (maintaining 2:1 ratio)
        assert_eq!(dims.width, 256);
        assert_eq!(dims.height, 128);
    }

    #[test]
    fn generate_thumbnail_maintains_aspect_ratio_portrait() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "tall.png", 400, 800);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(256)).unwrap();

        // Height should be 256, width should be 128 (maintaining 1:2 ratio)
        assert_eq!(dims.width, 128);
        assert_eq!(dims.height, 256);
    }

    #[test]
    fn generate_thumbnail_does_not_upscale() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "small.png", 100, 80);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(256)).unwrap();

        // Should stay at original size since it's smaller than max_size
        assert_eq!(dims.width, 100);
        assert_eq!(dims.height, 80);
    }

    #[test]
    fn generate_thumbnail_square_image() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "square.png", 512, 512);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(256)).unwrap();

        assert_eq!(dims.width, 256);
        assert_eq!(dims.height, 256);
    }

    #[test]
    fn generate_thumbnail_custom_max_size() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "large.png", 2000, 1000);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(128)).unwrap();

        assert_eq!(dims.width, 128);
        assert_eq!(dims.height, 64);
    }

    #[test]
    fn generate_thumbnail_default_max_size() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "large.png", 1024, 1024);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, None).unwrap();

        assert_eq!(dims.width, DEFAULT_MAX_SIZE);
        assert_eq!(dims.height, DEFAULT_MAX_SIZE);
    }

    #[test]
    fn generate_thumbnail_from_jpeg() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_jpeg(&temp_dir, "photo.jpg", 800, 600);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let dims = generate_thumbnail(&img_path, &thumb_path, Some(200)).unwrap();

        assert_eq!(dims.width, 200);
        assert_eq!(dims.height, 150);
    }

    #[test]
    fn generate_thumbnail_fails_for_missing_file() {
        let temp_dir = TempDir::new().unwrap();
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let result = generate_thumbnail("/nonexistent/image.png", &thumb_path, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open image"));
    }

    #[test]
    fn generate_thumbnail_fails_for_non_image_file() {
        let temp_dir = TempDir::new().unwrap();
        let text_path = temp_dir.path().join("not_image.txt");
        fs::write(&text_path, "this is not an image").unwrap();

        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let result = generate_thumbnail(text_path.to_str().unwrap(), &thumb_path, None);
        assert!(result.is_err());
    }

    #[test]
    fn generate_thumbnail_creates_output_directory() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "source.png", 500, 400);
        let thumb_path = temp_dir
            .path()
            .join("nested")
            .join("deep")
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        let result = generate_thumbnail(&img_path, &thumb_path, None);

        assert!(result.is_ok());
        assert!(Path::new(&thumb_path).exists());
    }

    #[test]
    fn thumbnail_output_path_constructs_correct_path() {
        let path = thumbnail_output_path("/projects/myproject", "asset-123");
        assert!(path.contains(".thumbnails"));
        assert!(path.contains("asset-123_thumb.png"));
    }

    #[test]
    fn generate_thumbnail_produces_valid_image() {
        let temp_dir = TempDir::new().unwrap();
        let img_path = create_test_image(&temp_dir, "source.png", 600, 400);
        let thumb_path = temp_dir
            .path()
            .join("thumb.png")
            .to_str()
            .unwrap()
            .to_string();

        generate_thumbnail(&img_path, &thumb_path, Some(128)).unwrap();

        // Verify the thumbnail is a valid image by reading its dimensions
        let dims = get_image_dimensions(&thumb_path).unwrap();
        assert_eq!(dims.width, 128);
        assert_eq!(dims.height, 85); // 400/600 * 128 ≈ 85
    }
}
