//! PDF export functionality.
//!
//! This module provides the core logic for exporting designs to PDF format.
//! It handles page setup, image positioning, and coordinate transformations.

use ::image::{ImageBuffer, Rgb as ImgRgb, RgbImage};
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
    #[serde(default)]
    pub background: Option<String>,
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
    #[serde(default)]
    pub border_style: Option<String>,
    #[serde(default)]
    pub border_color: Option<String>,
    #[serde(default)]
    pub border_width: Option<f64>,
}

/// A single page in a PDF export request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageExport {
    pub page: PdfPageConfig,
    pub images: Vec<PdfImageElement>,
}

/// Request structure for PDF export.
///
/// `page`/`images` are kept for backward-compatible single-page callers.
/// New multi-page callers should populate `pages`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    #[serde(default)]
    pub page: Option<PdfPageConfig>,
    #[serde(default)]
    pub images: Vec<PdfImageElement>,
    #[serde(default)]
    pub pages: Vec<PdfPageExport>,
    pub output_path: String,
}

impl PdfExportRequest {
    fn resolved_pages(&self) -> Result<Vec<PdfPageExport>, String> {
        if !self.pages.is_empty() {
            return Ok(self.pages.clone());
        }

        let page = self
            .page
            .clone()
            .ok_or_else(|| "PDF export request must include page or pages".to_string())?;

        Ok(vec![PdfPageExport {
            page,
            images: self.images.clone(),
        }])
    }
}

#[derive(Debug, Clone, PartialEq)]
enum PdfBackgroundSpec {
    Solid([u8; 3]),
    LinearGradient {
        angle_deg: f64,
        stops: Vec<GradientStop>,
    },
}

#[derive(Debug, Clone, PartialEq)]
struct GradientStop {
    color: [u8; 3],
    offset: f64,
}

fn resolve_background_spec(input: &str) -> &str {
    match input.trim() {
        "paper-white" => "#ffffff",
        "sandstone" => "#f4e7d3",
        "sage" => "#dce8d8",
        "midnight-ink" => "#22304a",
        "sunset-bloom" => "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #7c3aed 100%)",
        "ocean-mist" => "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
        "golden-hour" => "linear-gradient(160deg, #fff7cc 0%, #fbbf24 45%, #fb7185 100%)",
        "forest-haze" => "linear-gradient(145deg, #1f4d3a 0%, #7dd3a7 100%)",
        other => other,
    }
}

fn parse_hex_color(input: &str) -> Option<[u8; 3]> {
    let hex = input.trim().trim_start_matches('#');
    match hex.len() {
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some([r, g, b])
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some([r, g, b])
        }
        _ => None,
    }
}

fn split_gradient_args(input: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut depth = 0;

    for ch in input.chars() {
        match ch {
            '(' => {
                depth += 1;
                current.push(ch);
            }
            ')' => {
                depth -= 1;
                current.push(ch);
            }
            ',' if depth == 0 => {
                parts.push(current.trim().to_string());
                current.clear();
            }
            _ => current.push(ch),
        }
    }

    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }

    parts
}

fn parse_gradient_stop(segment: &str, index: usize, total: usize) -> Option<GradientStop> {
    let mut tokens = segment.split_whitespace();
    let color = parse_hex_color(tokens.next()?)?;
    let offset = tokens
        .next()
        .and_then(|token| token.strip_suffix('%'))
        .and_then(|token| token.parse::<f64>().ok())
        .map(|value| (value / 100.0).clamp(0.0, 1.0))
        .unwrap_or_else(|| {
            if total <= 1 {
                0.0
            } else {
                index as f64 / (total - 1) as f64
            }
        });

    Some(GradientStop { color, offset })
}

fn parse_background(input: &str) -> PdfBackgroundSpec {
    let resolved = resolve_background_spec(input);
    if let Some(color) = parse_hex_color(resolved) {
        return PdfBackgroundSpec::Solid(color);
    }

    let inner = resolved
        .strip_prefix("linear-gradient(")
        .and_then(|value| value.strip_suffix(')'));
    let Some(inner) = inner else {
        return PdfBackgroundSpec::Solid([255, 255, 255]);
    };

    let parts = split_gradient_args(inner);
    if parts.len() < 3 {
        return PdfBackgroundSpec::Solid([255, 255, 255]);
    }

    let Some(angle_str) = parts[0].strip_suffix("deg") else {
        return PdfBackgroundSpec::Solid([255, 255, 255]);
    };
    let Ok(angle_deg) = angle_str.parse::<f64>() else {
        return PdfBackgroundSpec::Solid([255, 255, 255]);
    };

    let stops: Vec<GradientStop> = parts[1..]
        .iter()
        .enumerate()
        .filter_map(|(index, segment)| parse_gradient_stop(segment, index, parts.len() - 1))
        .collect();

    if stops.len() < 2 {
        PdfBackgroundSpec::Solid([255, 255, 255])
    } else {
        PdfBackgroundSpec::LinearGradient { angle_deg, stops }
    }
}

fn interpolate_channel(start: u8, end: u8, factor: f64) -> u8 {
    (start as f64 + (end as f64 - start as f64) * factor)
        .round()
        .clamp(0.0, 255.0) as u8
}

fn sample_gradient_color(stops: &[GradientStop], position: f64) -> [u8; 3] {
    if position <= stops[0].offset {
        return stops[0].color;
    }

    for pair in stops.windows(2) {
        let start = &pair[0];
        let end = &pair[1];
        if position <= end.offset {
            let span = (end.offset - start.offset).max(f64::EPSILON);
            let factor = ((position - start.offset) / span).clamp(0.0, 1.0);
            return [
                interpolate_channel(start.color[0], end.color[0], factor),
                interpolate_channel(start.color[1], end.color[1], factor),
                interpolate_channel(start.color[2], end.color[2], factor),
            ];
        }
    }

    stops
        .last()
        .map(|stop| stop.color)
        .unwrap_or([255, 255, 255])
}

fn render_background_image(spec: &PdfBackgroundSpec, width: u32, height: u32) -> RgbImage {
    match spec {
        PdfBackgroundSpec::Solid([r, g, b]) => {
            ImageBuffer::from_pixel(width, height, ImgRgb([*r, *g, *b]))
        }
        PdfBackgroundSpec::LinearGradient { angle_deg, stops } => {
            let mut image = RgbImage::new(width, height);
            let radians = angle_deg.to_radians();
            let dx = radians.sin();
            let dy = -radians.cos();
            let center_x = (width as f64 - 1.0) / 2.0;
            let center_y = (height as f64 - 1.0) / 2.0;
            let extent = center_x.abs().max(center_y.abs()).max(1.0);

            for (x, y, pixel) in image.enumerate_pixels_mut() {
                let projected =
                    ((x as f64 - center_x) * dx + (y as f64 - center_y) * dy) / (extent * 2.0);
                let color = sample_gradient_color(stops, (0.5 + projected).clamp(0.0, 1.0));
                *pixel = ImgRgb(color);
            }

            image
        }
    }
}

fn add_background_to_layer(layer: &PdfLayerReference, page: &PdfPageConfig) {
    let spec = parse_background(page.background.as_deref().unwrap_or("#ffffff"));
    let long_edge = 1024.0;
    let aspect = if page.width_mm > 0.0 {
        page.height_mm / page.width_mm
    } else {
        1.0
    };
    let width_px = if aspect >= 1.0 {
        (long_edge / aspect).round().clamp(256.0, long_edge) as u32
    } else {
        long_edge as u32
    };
    let height_px = if aspect >= 1.0 {
        long_edge as u32
    } else {
        (long_edge * aspect).round().clamp(256.0, long_edge) as u32
    };
    let background = render_background_image(&spec, width_px.max(1), height_px.max(1));
    let image_xobject = ImageXObject {
        width: Px(width_px as usize),
        height: Px(height_px as usize),
        color_space: ColorSpace::Rgb,
        bits_per_component: ColorBits::Bit8,
        interpolate: true,
        image_data: background.into_raw(),
        image_filter: None,
        clipping_bbox: None,
        smask: None,
    };

    Image::from(image_xobject).add_to_layer(
        layer.clone(),
        ImageTransform {
            translate_x: Some(Mm(0.0)),
            translate_y: Some(Mm(0.0)),
            scale_x: Some(page.width_mm as f32 / width_px as f32 * (72.0 / 25.4)),
            scale_y: Some(page.height_mm as f32 / height_px as f32 * (72.0 / 25.4)),
            dpi: Some(72.0),
            ..Default::default()
        },
    );
}

fn border_preset_defaults(style: &str) -> Option<(&'static str, f64)> {
    match style {
        "custom" => Some(("#000000", 1.0)),
        "matte-frame" => Some(("#f5f1e8", 12.0)),
        "gallery-frame" => Some(("#1f2937", 6.0)),
        "ornate-gold" => Some(("#d4af37", 8.0)),
        "walnut-frame" => Some(("#5c3a21", 10.0)),
        _ => None,
    }
}

fn resolve_border_for_pdf(image: &PdfImageElement) -> Option<([u8; 3], f64)> {
    let preset = image
        .border_style
        .as_deref()
        .and_then(border_preset_defaults);
    let width_mm = image.border_width.or_else(|| preset.map(|(_, w)| w))?;
    if !width_mm.is_finite() || width_mm <= 0.0 {
        return None;
    }

    let color = image
        .border_color
        .as_deref()
        .and_then(parse_hex_color)
        .or_else(|| preset.and_then(|(color, _)| parse_hex_color(color)))
        .unwrap_or([0, 0, 0]);

    Some((color, width_mm))
}

fn draw_image_border(
    layer: &PdfLayerReference,
    page: &PdfPageConfig,
    image: &PdfImageElement,
    border_color: [u8; 3],
    border_width_mm: f64,
) {
    const MM_TO_PT: f64 = 72.0 / 25.4;
    let y_pdf = page.height_mm - image.y_mm - image.height_mm;
    let x = image.x_mm as f32;
    let y = y_pdf as f32;
    let width = image.width_mm as f32;
    let height = image.height_mm as f32;

    layer.set_outline_color(Color::Rgb(Rgb::new(
        border_color[0] as f32 / 255.0,
        border_color[1] as f32 / 255.0,
        border_color[2] as f32 / 255.0,
        None,
    )));
    layer.set_outline_thickness((border_width_mm * MM_TO_PT) as f32);
    layer.add_line(Line {
        points: vec![
            (Point::new(Mm(x), Mm(y)), false),
            (Point::new(Mm(x + width), Mm(y)), false),
            (Point::new(Mm(x + width), Mm(y + height)), false),
            (Point::new(Mm(x), Mm(y + height)), false),
        ],
        is_closed: true,
    });
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
fn add_images_to_layer(
    current_layer: &PdfLayerReference,
    page: &PdfPageConfig,
    images: &[PdfImageElement],
) -> Result<(), String> {
    for img_elem in images {
        let image_bytes = std::fs::read(&img_elem.image_path)
            .map_err(|e| format!("Failed to read image {}: {}", img_elem.image_path, e))?;

        let path_lower = img_elem.image_path.to_lowercase();
        let is_jpeg = path_lower.ends_with(".jpg") || path_lower.ends_with(".jpeg");
        let (width_px, height_px, image_xobject) = if is_jpeg {
            let img = ::image::ImageReader::new(Cursor::new(&image_bytes))
                .with_guessed_format()
                .map_err(|e| format!("Failed to create image reader: {}", e))?
                .decode()
                .map_err(|e| format!("Failed to decode JPEG image: {}", e))?;
            let width_px = img.width();
            let height_px = img.height();
            (
                width_px,
                height_px,
                ImageXObject {
                    width: Px(width_px as usize),
                    height: Px(height_px as usize),
                    color_space: ColorSpace::Rgb,
                    bits_per_component: ColorBits::Bit8,
                    interpolate: true,
                    image_data: image_bytes,
                    image_filter: Some(ImageFilter::DCT),
                    clipping_bbox: None,
                    smask: None,
                },
            )
        } else {
            let img = ::image::ImageReader::new(Cursor::new(&image_bytes))
                .with_guessed_format()
                .map_err(|e| format!("Failed to create image reader: {}", e))?
                .decode()
                .map_err(|e| format!("Failed to decode image: {}", e))?;
            let rgb_img = img.to_rgb8();
            let width_px = rgb_img.width();
            let height_px = rgb_img.height();
            (
                width_px,
                height_px,
                ImageXObject {
                    width: Px(width_px as usize),
                    height: Px(height_px as usize),
                    color_space: ColorSpace::Rgb,
                    bits_per_component: ColorBits::Bit8,
                    interpolate: true,
                    image_data: rgb_img.into_raw(),
                    image_filter: None,
                    clipping_bbox: None,
                    smask: None,
                },
            )
        };

        let pdf_image = Image::from(image_xobject);
        let y_pdf = page.height_mm - img_elem.y_mm - img_elem.height_mm;

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
        if let Some((border_color, border_width_mm)) = resolve_border_for_pdf(img_elem) {
            draw_image_border(current_layer, page, img_elem, border_color, border_width_mm);
        }
    }

    Ok(())
}

pub fn export_pdf(request: &PdfExportRequest) -> Result<(), String> {
    let pages = request.resolved_pages()?;
    let first = pages
        .first()
        .ok_or_else(|| "PDF export request contains no pages".to_string())?;

    let (doc, page1, layer1) = PdfDocument::new(
        "Design Studio Pro Export",
        Mm(first.page.width_mm as f32),
        Mm(first.page.height_mm as f32),
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);
    add_background_to_layer(&current_layer, &first.page);
    add_images_to_layer(&current_layer, &first.page, &first.images)?;

    for page_export in pages.iter().skip(1) {
        let (page, layer) = doc.add_page(
            Mm(page_export.page.width_mm as f32),
            Mm(page_export.page.height_mm as f32),
            "Layer 1",
        );
        let current_layer = doc.get_page(page).get_layer(layer);
        add_background_to_layer(&current_layer, &page_export.page);
        add_images_to_layer(&current_layer, &page_export.page, &page_export.images)?;
    }

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
            page: Some(PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#ffffff".to_string()),
            }),
            images: vec![],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export empty PDF: {:?}", result);

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
    }

    #[test]
    fn test_export_with_image() {
        use ::image::{ImageBuffer, ImageFormat, Rgb};

        let mut img_buffer: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(100, 100);
        for (x, y, pixel) in img_buffer.enumerate_pixels_mut() {
            let r = ((x as f32 / 100.0) * 255.0) as u8;
            let g = ((y as f32 / 100.0) * 255.0) as u8;
            let b = 128;
            *pixel = Rgb([r, g, b]);
        }

        let test_image = NamedTempFile::with_suffix(".png").unwrap();
        let test_image_path = test_image.path().to_str().unwrap().to_string();
        img_buffer
            .save_with_format(&test_image_path, ImageFormat::Png)
            .unwrap();

        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("sunset-bloom".to_string()),
            }),
            images: vec![PdfImageElement {
                image_path: test_image_path,
                x_mm: 10.0,
                y_mm: 20.0,
                width_mm: 50.0,
                height_mm: 50.0,
                rotation_deg: 0.0,
                border_style: None,
                border_color: None,
                border_width: None,
            }],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(
            result.is_ok(),
            "Failed to export PDF with image: {:?}",
            result
        );

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
        assert!(pdf_bytes.len() > 1000, "PDF seems too small");
    }

    #[test]
    fn test_y_coordinate_flipping() {
        use ::image::{ImageBuffer, ImageFormat, Rgb};

        let img_buffer: ImageBuffer<Rgb<u8>, Vec<u8>> =
            ImageBuffer::from_pixel(50, 50, Rgb([255, 0, 0]));
        let test_image = NamedTempFile::with_suffix(".png").unwrap();
        let test_image_path = test_image.path().to_str().unwrap().to_string();
        img_buffer
            .save_with_format(&test_image_path, ImageFormat::Png)
            .unwrap();

        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 100.0,
                height_mm: 100.0,
                background: Some("#ffffff".to_string()),
            }),
            images: vec![PdfImageElement {
                image_path: test_image_path,
                x_mm: 0.0,
                y_mm: 0.0,
                width_mm: 25.0,
                height_mm: 25.0,
                rotation_deg: 0.0,
                border_style: None,
                border_color: None,
                border_width: None,
            }],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export PDF: {:?}", result);

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
    }

    #[test]
    fn test_a4_page_dimensions() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#ffffff".to_string()),
            }),
            images: vec![],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(result.is_ok(), "Failed to export A4 PDF: {:?}", result);

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");

        let pdf_text = String::from_utf8_lossy(&pdf_bytes);
        assert!(pdf_text.contains("MediaBox"), "PDF should contain MediaBox");

        let has_correct_width = pdf_text.contains("595.2") || pdf_text.contains("595.3");
        let has_correct_height = pdf_text.contains("841.8") || pdf_text.contains("841.9");

        assert!(
            has_correct_width,
            "PDF width should be approximately 595.28pt for A4"
        );
        assert!(
            has_correct_height,
            "PDF height should be approximately 841.89pt for A4"
        );
    }

    #[test]
    fn test_parse_gradient_background_preset() {
        let spec = parse_background("ocean-mist");
        assert!(matches!(spec, PdfBackgroundSpec::LinearGradient { .. }));
    }

    #[test]
    fn test_resolve_border_from_style_defaults() {
        let image = PdfImageElement {
            image_path: "/tmp/photo.png".to_string(),
            x_mm: 0.0,
            y_mm: 0.0,
            width_mm: 10.0,
            height_mm: 10.0,
            rotation_deg: 0.0,
            border_style: Some("walnut-frame".to_string()),
            border_color: None,
            border_width: None,
        };

        let resolved = resolve_border_for_pdf(&image).expect("expected border");
        assert_eq!(resolved.0, [92, 58, 33]);
        assert_eq!(resolved.1, 10.0);
    }
}
