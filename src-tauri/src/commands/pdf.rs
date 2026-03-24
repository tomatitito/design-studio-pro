//! PDF export commands.
//!
//! This module exposes Tauri commands for PDF export functionality.

use crate::core::pdf::{export_pdf as export_pdf_core, PdfExportRequest};

/// Export a design to PDF format.
///
/// This command is invoked from the frontend via Tauri IPC.
/// It runs on a blocking thread pool since it involves file I/O.
///
/// # Arguments
///
/// * `request` - The PDF export request containing page config, images, and output path
///
/// # Returns
///
/// * `Ok(String)` with the output path on success
/// * `Err(String)` with error message on failure
#[tauri::command]
pub async fn export_pdf(request: PdfExportRequest) -> Result<String, String> {
    let output = request.output_path.clone();

    // Run on blocking thread pool since we're doing file I/O
    tokio::task::spawn_blocking(move || export_pdf_core(&request))
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::pdf::{PdfImageElement, PdfPageConfig};
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_export_pdf_command() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#ffffff".to_string()),
            },
            images: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(request).await;
        assert!(result.is_ok(), "Failed to export PDF: {:?}", result);
        assert_eq!(result.unwrap(), output_path);
    }

    #[tokio::test]
    async fn test_export_pdf_with_invalid_path() {
        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#ffffff".to_string()),
            },
            images: vec![PdfImageElement {
                image_path: "/nonexistent/image.png".to_string(),
                x_mm: 0.0,
                y_mm: 0.0,
                width_mm: 50.0,
                height_mm: 50.0,
                rotation_deg: 0.0,
                border_style: None,
                border_color: None,
                border_width: None,
            }],
            output_path: "/tmp/test.pdf".to_string(),
        };

        let result = export_pdf(request).await;
        assert!(result.is_err(), "Should fail with nonexistent image");
    }
}
