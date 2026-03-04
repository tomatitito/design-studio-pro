//! PDF export functionality.
//!
//! This module provides the core logic for exporting designs to PDF format.
//! It handles page setup, image positioning, and coordinate transformations.

use printpdf::*;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufWriter, Cursor};

/// Configuration for a PDF page.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageConfig {
    pub width_mm: f64,
    pub height_mm: f64,
}

/// An image element to be placed in the PDF.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfImageElement {
    pub image_path: String,
    pub x_mm: f64,
    pub y_mm: f64,
    pub width_mm: f64,
    pub height_mm: f64,
    pub rotation_deg: f64,
}

/// Request structure for PDF export.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    pub page: PdfPageConfig,
    pub images: Vec<PdfImageElement>,
    pub output_path: String,
}

/// Export a design to PDF format.
///
/// # Arguments
///
/// * `request` - The export request containing page config, images, and output path
///
/// # Returns
///
/// * `Ok(())` on success
/// * `Err(String)` with error message on failure
///
/// # Coordinate System
///
/// The input coordinates use a top-left origin (typical for design tools),
/// but PDF uses a bottom-left origin. This function handles the conversion.
pub fn export_pdf(request: &PdfExportRequest) -> Result<(), String> {
    // Create a new PDF document
    let (doc, page1, layer1) =
        PdfDocument::new("Design Studio Pro Export", Mm(request.page.width_mm as f32), Mm(request.page.height_mm as f32), "Layer 1");

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Process each image element
    for img_elem in &request.images {
        // Read the image file
        let image_bytes = std::fs::read(&img_elem.image_path)
            .map_err(|e| format!("Failed to read image {}: {}", img_elem.image_path, e))?;

        // Determine image format from extension
        let path_lower = img_elem.image_path.to_lowercase();
        let is_jpeg = path_lower.ends_with(".jpg") || path_lower.ends_with(".jpeg");

        if is_jpeg {
            // Handle JPEG images - use raw JPEG data
            // First decode to get dimensions
            let img = ::image::ImageReader::new(Cursor::new(&image_bytes))
                .with_guessed_format()
                .map_err(|e| format!("Failed to create image reader: {}", e))?
                .decode()
                .map_err(|e| format!("Failed to decode JPEG image: {}", e))?;

            let width_px = img.width();
            let height_px = img.height();

            // Create ImageXObject with raw JPEG data
            let image_xobject = ImageXObject {
                width: Px(width_px as usize),
                height: Px(height_px as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: image_bytes,
                image_filter: Some(ImageFilter::DCT),
                clipping_bbox: None,
                smask: None,
            };

            let pdf_image = Image::from(image_xobject);

            // Convert coordinates: PDF uses bottom-left origin
            let y_pdf = request.page.height_mm - img_elem.y_mm - img_elem.height_mm;

            // Add image to the layer with transformations
            pdf_image.add_to_layer(
                current_layer.clone(),
                ImageTransform {
                    translate_x: Some(Mm(img_elem.x_mm as f32)),
                    translate_y: Some(Mm(y_pdf as f32)),
                    rotate: if img_elem.rotation_deg != 0.0 {
                        Some(ImageRotation {
                            angle_ccw_degrees: img_elem.rotation_deg as f32,
                            rotation_center_x: Px(0),
                            rotation_center_y: Px(0),
                        })
                    } else {
                        None
                    },
                    scale_x: Some({
                        let img_width_mm = width_px as f64 * 25.4 / 72.0;
                        (img_elem.width_mm / img_width_mm) as f32
                    }),
                    scale_y: Some({
                        let img_height_mm = height_px as f64 * 25.4 / 72.0;
                        (img_elem.height_mm / img_height_mm) as f32
                    }),
                    dpi: Some(72.0),
                    ..Default::default()
                },
            );
        } else {
            // Handle PNG and other formats - decode to RGB8
            let img = ::image::ImageReader::new(Cursor::new(&image_bytes))
                .with_guessed_format()
                .map_err(|e| format!("Failed to create image reader: {}", e))?
                .decode()
                .map_err(|e| format!("Failed to decode image: {}", e))?;

            let rgb_img = img.to_rgb8();
            let width_px = rgb_img.width();
            let height_px = rgb_img.height();
            let raw_pixels = rgb_img.into_raw();

            // Create ImageXObject with raw RGB data
            let image_xobject = ImageXObject {
                width: Px(width_px as usize),
                height: Px(height_px as usize),
                color_space: ColorSpace::Rgb,
                bits_per_component: ColorBits::Bit8,
                interpolate: true,
                image_data: raw_pixels,
                image_filter: None, // Raw data without compression
                clipping_bbox: None,
                smask: None,
            };

            let pdf_image = Image::from(image_xobject);

            // Convert coordinates: PDF uses bottom-left origin
            let y_pdf = request.page.height_mm - img_elem.y_mm - img_elem.height_mm;

            // Add image to the layer with transformations
            pdf_image.add_to_layer(
                current_layer.clone(),
                ImageTransform {
                    translate_x: Some(Mm(img_elem.x_mm as f32)),
                    translate_y: Some(Mm(y_pdf as f32)),
                    rotate: if img_elem.rotation_deg != 0.0 {
                        Some(ImageRotation {
                            angle_ccw_degrees: img_elem.rotation_deg as f32,
                            rotation_center_x: Px(0),
                            rotation_center_y: Px(0),
                        })
                    } else {
                        None
                    },
                    scale_x: Some({
                        let img_width_mm = width_px as f64 * 25.4 / 72.0;
                        (img_elem.width_mm / img_width_mm) as f32
                    }),
                    scale_y: Some({
                        let img_height_mm = height_px as f64 * 25.4 / 72.0;
                        (img_elem.height_mm / img_height_mm) as f32
                    }),
                    dpi: Some(72.0),
                    ..Default::default()
                },
            );
        }
    }

    // Save the PDF to the output path
    let file = File::create(&request.output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;

    let mut writer = BufWriter::new(file);
    doc.save(&mut writer)
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn test_export_empty_page() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
            },
            images: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export empty PDF: {:?}", result);

        // Verify the file exists and starts with PDF header
        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
    }

    #[test]
    fn test_export_with_image() {
        use ::image::{ImageBuffer, ImageFormat, Rgb};

        // Create a test PNG image programmatically
        let mut img_buffer: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(100, 100);
        for (x, y, pixel) in img_buffer.enumerate_pixels_mut() {
            let r = ((x as f32 / 100.0) * 255.0) as u8;
            let g = ((y as f32 / 100.0) * 255.0) as u8;
            let b = 128;
            *pixel = Rgb([r, g, b]);
        }

        let test_image = NamedTempFile::with_suffix(".png").unwrap();
        let test_image_path = test_image.path().to_str().unwrap().to_string();
        img_buffer.save_with_format(&test_image_path, ImageFormat::Png).unwrap();

        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
            },
            images: vec![PdfImageElement {
                image_path: test_image_path,
                x_mm: 10.0,
                y_mm: 20.0,
                width_mm: 50.0,
                height_mm: 50.0,
                rotation_deg: 0.0,
            }],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export PDF with image: {:?}", result);

        // Verify the file exists and is a valid PDF
        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
        assert!(pdf_bytes.len() > 1000, "PDF seems too small");
    }

    #[test]
    fn test_y_coordinate_flipping() {
        use ::image::{ImageBuffer, ImageFormat, Rgb};

        // Create a small test image
        let img_buffer: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_pixel(50, 50, Rgb([255, 0, 0]));
        let test_image = NamedTempFile::with_suffix(".png").unwrap();
        let test_image_path = test_image.path().to_str().unwrap().to_string();
        img_buffer.save_with_format(&test_image_path, ImageFormat::Png).unwrap();

        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        // Place image at top of page (y=0 in top-left coordinates)
        // Should be converted to bottom of page in PDF coordinates
        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 100.0,
                height_mm: 100.0,
            },
            images: vec![PdfImageElement {
                image_path: test_image_path,
                x_mm: 0.0,
                y_mm: 0.0,  // Top in design coordinates
                width_mm: 25.0,
                height_mm: 25.0,
                rotation_deg: 0.0,
            }],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export PDF: {:?}", result);

        // Verify the PDF was created
        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
    }

    #[test]
    fn test_a4_page_dimensions() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
            },
            images: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export A4 PDF: {:?}", result);

        // Read and verify PDF dimensions
        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");

        // Convert bytes to string to search for MediaBox
        let pdf_text = String::from_utf8_lossy(&pdf_bytes);

        // A4 in points: 210mm = 595.28pt, 297mm = 841.89pt
        // PDF uses points (1pt = 1/72 inch = 0.3528mm)
        // 210mm / 0.3528mm = 595.28pt
        // 297mm / 0.3528mm = 841.89pt
        assert!(pdf_text.contains("MediaBox"), "PDF should contain MediaBox");

        // Check if the MediaBox contains values close to A4 dimensions
        // The exact format might be "/MediaBox [0 0 595.28 841.89]" or similar
        let has_correct_width = pdf_text.contains("595.2") || pdf_text.contains("595.3");
        let has_correct_height = pdf_text.contains("841.8") || pdf_text.contains("841.9");

        assert!(has_correct_width, "PDF width should be approximately 595.28pt for A4");
        assert!(has_correct_height, "PDF height should be approximately 841.89pt for A4");
    }

    #[test]
    fn test_centered_image_placement() {
        use ::image::{ImageBuffer, ImageFormat, Rgb};

        // Create a 100x100px test image
        let img_buffer: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_pixel(100, 100, Rgb([0, 128, 255]));
        let test_image = NamedTempFile::with_suffix(".png").unwrap();
        let test_image_path = test_image.path().to_str().unwrap().to_string();
        img_buffer.save_with_format(&test_image_path, ImageFormat::Png).unwrap();

        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        // Place a 50mm x 50mm image centered on A4 page
        // A4 center: 105mm x 148.5mm
        // Image top-left should be at: (105 - 25, 148.5 - 25) = (80, 123.5)
        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
            },
            images: vec![PdfImageElement {
                image_path: test_image_path,
                x_mm: 80.0,
                y_mm: 123.5,
                width_mm: 50.0,
                height_mm: 50.0,
                rotation_deg: 0.0,
            }],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export PDF with centered image: {:?}", result);

        // Verify the PDF was created
        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
        assert!(pdf_bytes.len() > 1000, "PDF seems too small");

        // The image should be properly scaled and positioned
        // We can't easily verify the exact position without parsing the PDF,
        // but we can verify it was created successfully
    }
}
