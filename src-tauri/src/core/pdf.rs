//! PDF export functionality.
//!
//! This module provides the core logic for exporting designs to PDF format.
//! It handles page setup, image positioning, and coordinate transformations.

use ::image::{ImageBuffer, Rgb as ImgRgb, RgbImage};
use printpdf::path::{PaintMode, WindingOrder};
use printpdf::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

/// A text element to be placed in the PDF.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextElement {
    pub content: String,
    pub x_mm: f64,
    pub y_mm: f64,
    pub width_mm: f64,
    pub height_mm: f64,
    pub rotation_deg: f64,
    pub font_family: String,
    pub font_size: f64,
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_weight: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_align: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub letter_spacing: Option<f64>,
}

/// A shape/decorative element to be placed in the PDF.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfShapeElement {
    pub shape_kind: String,
    pub x_mm: f64,
    pub y_mm: f64,
    pub width_mm: f64,
    pub height_mm: f64,
    pub rotation_deg: f64,
    pub fill: String,
    pub stroke: String,
    pub stroke_width: f64,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
}

fn default_opacity() -> f64 {
    1.0
}

/// A z-ordered renderable element. Existing `images`/`texts` fields remain for
/// compatibility; new callers populate this list so decorative shapes can be
/// layered relative to photos and text. Opacity is accepted but currently
/// flattened to opaque PDF drawing because the backend does not emit PDF
/// transparency groups yet.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "elementType",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
pub enum PdfRenderableElement {
    Image(PdfImageElement),
    Text(PdfTextElement),
    Shape(PdfShapeElement),
}

/// A single page in a PDF export request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageExport {
    pub page: PdfPageConfig,
    pub images: Vec<PdfImageElement>,
    #[serde(default)]
    pub texts: Vec<PdfTextElement>,
    #[serde(default)]
    pub shapes: Vec<PdfShapeElement>,
    #[serde(default)]
    pub elements: Vec<PdfRenderableElement>,
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
    pub texts: Vec<PdfTextElement>,
    #[serde(default)]
    pub shapes: Vec<PdfShapeElement>,
    #[serde(default)]
    pub elements: Vec<PdfRenderableElement>,
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
            texts: self.texts.clone(),
            shapes: self.shapes.clone(),
            elements: self.elements.clone(),
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
fn color_from_hex(input: &str, fallback: [u8; 3]) -> [u8; 3] {
    parse_hex_color(input).unwrap_or(fallback)
}

fn pdf_rgb(color: [u8; 3]) -> Color {
    Color::Rgb(Rgb::new(
        color[0] as f32 / 255.0,
        color[1] as f32 / 255.0,
        color[2] as f32 / 255.0,
        None,
    ))
}

fn page_y(page: &PdfPageConfig, y_mm: f64, height_mm: f64) -> f32 {
    (page.height_mm - y_mm - height_mm) as f32
}

fn add_shape_to_layer(
    layer: &PdfLayerReference,
    page: &PdfPageConfig,
    shape: &PdfShapeElement,
) -> Result<(), String> {
    if !shape.width_mm.is_finite()
        || !shape.height_mm.is_finite()
        || shape.width_mm <= 0.0
        || shape.height_mm <= 0.0
    {
        return Ok(());
    }

    if shape.rotation_deg.is_finite() && shape.rotation_deg.abs() > f64::EPSILON {
        // Scoped limitation: decorative shape rotation is not yet implemented in
        // the backend PDF vector fallback. Export the unrotated primitive instead
        // of dropping it so backgrounds/accents remain visible and layered.
        log::warn!(
            "PDF decorative shape rotation is unsupported; exporting '{}' unrotated ({}°)",
            shape.shape_kind,
            shape.rotation_deg
        );
    }

    layer.set_fill_color(pdf_rgb(color_from_hex(&shape.fill, [255, 255, 255])));
    layer.set_outline_color(pdf_rgb(color_from_hex(&shape.stroke, [0, 0, 0])));
    layer.set_outline_thickness((shape.stroke_width.max(0.0) * MM_TO_PT) as f32);

    let x = shape.x_mm as f32;
    let y = page_y(page, shape.y_mm, shape.height_mm);
    let width = shape.width_mm as f32;
    let height = shape.height_mm as f32;

    match shape.shape_kind.as_str() {
        "rectangle" => {
            layer.add_polygon(Polygon {
                rings: vec![vec![
                    (Point::new(Mm(x), Mm(y)), false),
                    (Point::new(Mm(x + width), Mm(y)), false),
                    (Point::new(Mm(x + width), Mm(y + height)), false),
                    (Point::new(Mm(x), Mm(y + height)), false),
                ]],
                mode: PaintMode::FillStroke,
                winding_order: WindingOrder::NonZero,
            });
        }
        "ellipse" => {
            let cx = x + width / 2.0;
            let cy = y + height / 2.0;
            let rx = width / 2.0;
            let ry = height / 2.0;
            let k = 0.552_284_8_f32;
            layer.add_polygon(Polygon {
                rings: vec![vec![
                    (Point::new(Mm(cx + rx), Mm(cy)), true),
                    (Point::new(Mm(cx + rx), Mm(cy + k * ry)), true),
                    (Point::new(Mm(cx + k * rx), Mm(cy + ry)), false),
                    (Point::new(Mm(cx), Mm(cy + ry)), true),
                    (Point::new(Mm(cx - k * rx), Mm(cy + ry)), true),
                    (Point::new(Mm(cx - rx), Mm(cy + k * ry)), false),
                    (Point::new(Mm(cx - rx), Mm(cy)), true),
                    (Point::new(Mm(cx - rx), Mm(cy - k * ry)), true),
                    (Point::new(Mm(cx - k * rx), Mm(cy - ry)), false),
                    (Point::new(Mm(cx), Mm(cy - ry)), true),
                    (Point::new(Mm(cx + k * rx), Mm(cy - ry)), true),
                    (Point::new(Mm(cx + rx), Mm(cy - k * ry)), false),
                ]],
                mode: PaintMode::FillStroke,
                winding_order: WindingOrder::NonZero,
            });
        }
        "line" => {
            layer.add_line(Line {
                points: vec![
                    (Point::new(Mm(x), Mm(y + height)), false),
                    (Point::new(Mm(x + width), Mm(y)), false),
                ],
                is_closed: false,
            });
        }
        other => {
            return Err(format!(
                "Unsupported PDF decorative shape kind: {} (fill/stroke fallback unavailable)",
                other
            ));
        }
    }

    Ok(())
}

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum PdfFontFace {
    Helvetica,
    HelveticaBold,
    Times,
    TimesBold,
    Courier,
    CourierBold,
    Caveat,
}

#[derive(Debug, Clone, PartialEq)]
struct LaidOutTextLine {
    content: String,
    x_mm: f64,
    baseline_y_mm: f64,
}

const MM_TO_PT: f64 = 72.0 / 25.4;
const PT_TO_MM: f64 = 25.4 / 72.0;
const CAVEAT_FONT_BYTES: &[u8] =
    include_bytes!("../../../src/assets/fonts/Caveat-VariableFont_wght.ttf");

fn is_bold_weight(weight: Option<&str>) -> bool {
    weight
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            normalized == "bold"
                || normalized == "bolder"
                || normalized
                    .parse::<u16>()
                    .map(|numeric| numeric >= 600)
                    .unwrap_or(false)
        })
        .unwrap_or(false)
}

fn resolve_pdf_font_face(font_family: &str, font_weight: Option<&str>) -> PdfFontFace {
    let family = font_family.to_ascii_lowercase();
    let bold = is_bold_weight(font_weight);

    if family.contains("caveat") {
        return PdfFontFace::Caveat;
    }
    if family.contains("courier") || family.contains("mono") {
        return if bold {
            PdfFontFace::CourierBold
        } else {
            PdfFontFace::Courier
        };
    }
    if family.contains("times")
        || family.contains("georgia")
        || family.contains("serif") && !family.contains("sans-serif")
    {
        return if bold {
            PdfFontFace::TimesBold
        } else {
            PdfFontFace::Times
        };
    }

    if bold {
        PdfFontFace::HelveticaBold
    } else {
        PdfFontFace::Helvetica
    }
}

fn approximate_char_width_factor(ch: char, face: PdfFontFace) -> f64 {
    if ch.is_whitespace() {
        return 0.32;
    }
    if matches!(face, PdfFontFace::Courier | PdfFontFace::CourierBold) {
        return 0.60;
    }
    if matches!(face, PdfFontFace::Caveat) {
        return if ch.is_ascii_uppercase() { 0.55 } else { 0.42 };
    }
    if "ilI.,:;|'!".contains(ch) {
        0.25
    } else if "mwMW@&%".contains(ch) {
        0.82
    } else if ch.is_ascii_uppercase() || ch.is_numeric() {
        0.58
    } else {
        0.50
    }
}

fn approximate_text_width_mm(content: &str, text: &PdfTextElement, face: PdfFontFace) -> f64 {
    let font_size_mm = text.visible_font_size() * PT_TO_MM;
    let letter_spacing_mm = text.visible_letter_spacing_em() * font_size_mm;
    let glyph_width: f64 = content
        .chars()
        .map(|ch| approximate_char_width_factor(ch, face) * font_size_mm)
        .sum();
    let gaps = content.chars().count().saturating_sub(1) as f64;
    glyph_width + gaps * letter_spacing_mm
}

fn whitespace_preserving_segments(paragraph: &str) -> Vec<&str> {
    let mut segments = Vec::new();
    let mut start = 0;
    let mut current_is_whitespace = None;

    for (index, ch) in paragraph.char_indices() {
        let is_whitespace = ch.is_whitespace();
        match current_is_whitespace {
            None => current_is_whitespace = Some(is_whitespace),
            Some(previous) if previous != is_whitespace => {
                segments.push(&paragraph[start..index]);
                start = index;
                current_is_whitespace = Some(is_whitespace);
            }
            _ => {}
        }
    }

    if start < paragraph.len() {
        segments.push(&paragraph[start..]);
    }

    segments
}

fn wrap_paragraph(paragraph: &str, text: &PdfTextElement, face: PdfFontFace) -> Vec<String> {
    if paragraph.is_empty() {
        return vec![String::new()];
    }

    let max_width = text.width_mm.max(0.0);
    if max_width <= 0.0 || approximate_text_width_mm(paragraph, text, face) <= max_width {
        return vec![paragraph.to_string()];
    }

    let mut lines = Vec::new();
    let mut current = String::new();

    for segment in whitespace_preserving_segments(paragraph) {
        let candidate = format!("{}{}", current, segment);

        if approximate_text_width_mm(&candidate, text, face) <= max_width || current.is_empty() {
            current = candidate;
            continue;
        }

        lines.push(current);
        current = segment.to_string();
    }

    if !current.is_empty() {
        lines.push(current);
    }

    lines
}

fn layout_text_lines(text: &PdfTextElement, face: PdfFontFace) -> Vec<LaidOutTextLine> {
    let font_size = text.visible_font_size();
    let line_height_mm = text.line_height_mm();
    let box_height = text.height_mm.max(line_height_mm);
    let max_lines = ((box_height / line_height_mm).floor() as usize).max(1);
    let baseline_offset_mm = font_size * 0.82 * PT_TO_MM;

    let mut lines = Vec::new();
    for paragraph in text.content.split('\n') {
        lines.extend(wrap_paragraph(paragraph, text, face));
    }

    lines
        .into_iter()
        .take(max_lines)
        .enumerate()
        .map(|(index, content)| {
            let line_width = approximate_text_width_mm(&content, text, face);
            let remaining = (text.width_mm - line_width).max(0.0);
            let align_offset = match text.text_align.as_deref().unwrap_or("left") {
                "center" => remaining / 2.0,
                "right" => remaining,
                // PDF export intentionally falls back to left alignment for Fabric's
                // `justify`: robust word/character expansion needs browser-grade text
                // shaping and is out of scope for this backend exporter slice.
                "justify" => 0.0,
                _ => 0.0,
            };

            LaidOutTextLine {
                content,
                x_mm: text.x_mm + align_offset,
                baseline_y_mm: text.y_mm + baseline_offset_mm + index as f64 * line_height_mm,
            }
        })
        .collect()
}

fn builtin_font_for_face(face: PdfFontFace) -> BuiltinFont {
    match face {
        PdfFontFace::Helvetica | PdfFontFace::Caveat => BuiltinFont::Helvetica,
        PdfFontFace::HelveticaBold => BuiltinFont::HelveticaBold,
        PdfFontFace::Times => BuiltinFont::TimesRoman,
        PdfFontFace::TimesBold => BuiltinFont::TimesBold,
        PdfFontFace::Courier => BuiltinFont::Courier,
        PdfFontFace::CourierBold => BuiltinFont::CourierBold,
    }
}

fn load_font(
    doc: &PdfDocumentReference,
    cache: &mut HashMap<PdfFontFace, IndirectFontRef>,
    face: PdfFontFace,
) -> Result<IndirectFontRef, String> {
    if let Some(font) = cache.get(&face) {
        return Ok(font.clone());
    }

    let loaded = if face == PdfFontFace::Caveat {
        doc.add_external_font(Cursor::new(CAVEAT_FONT_BYTES))
    } else {
        doc.add_builtin_font(builtin_font_for_face(face))
    }
    .map_err(|e| format!("Failed to add PDF text font: {}", e))?;

    cache.insert(face, loaded.clone());
    Ok(loaded)
}

fn add_texts_to_layer(
    current_layer: &PdfLayerReference,
    doc: &PdfDocumentReference,
    page: &PdfPageConfig,
    texts: &[PdfTextElement],
) -> Result<(), String> {
    if texts.is_empty() {
        return Ok(());
    }

    let mut font_cache = HashMap::new();

    for text in texts {
        if text.content.is_empty() || !text.visible_font_size().is_finite() {
            continue;
        }

        let face = resolve_pdf_font_face(&text.font_family, text.font_weight.as_deref());
        let font = load_font(doc, &mut font_cache, face)?;
        let color = parse_hex_color(&text.color).unwrap_or([0, 0, 0]);
        current_layer.set_fill_color(Color::Rgb(Rgb::new(
            color[0] as f32 / 255.0,
            color[1] as f32 / 255.0,
            color[2] as f32 / 255.0,
            None,
        )));

        for line in layout_text_lines(text, face) {
            if line.content.is_empty() {
                continue;
            }

            let y_pdf = page.height_mm - line.baseline_y_mm;
            current_layer.begin_text_section();
            current_layer.set_font(&font, text.visible_font_size() as f32);
            current_layer.set_line_height((text.line_height_mm() * MM_TO_PT) as f32);
            current_layer.set_character_spacing(
                (text.visible_letter_spacing_em() * text.visible_font_size()) as f32,
            );
            // Multiline rotated text is approximated line-by-line around each line baseline.
            // This keeps scope bounded while preserving the existing single-line rotation path.
            current_layer.set_text_matrix(TextMatrix::TranslateRotate(
                Pt((line.x_mm * MM_TO_PT) as f32),
                Pt((y_pdf * MM_TO_PT) as f32),
                text.rotation_deg as f32,
            ));
            current_layer.write_text(line.content, &font);
            current_layer.end_text_section();
        }
    }

    Ok(())
}

fn add_renderable_elements_to_layer(
    current_layer: &PdfLayerReference,
    doc: &PdfDocumentReference,
    page: &PdfPageConfig,
    elements: &[PdfRenderableElement],
) -> Result<(), String> {
    for element in elements {
        match element {
            PdfRenderableElement::Image(image) => {
                add_images_to_layer(current_layer, page, std::slice::from_ref(image))?
            }
            PdfRenderableElement::Text(text) => {
                add_texts_to_layer(current_layer, doc, page, std::slice::from_ref(text))?
            }
            PdfRenderableElement::Shape(shape) => add_shape_to_layer(current_layer, page, shape)?,
        }
    }

    Ok(())
}

fn add_page_content_to_layer(
    current_layer: &PdfLayerReference,
    doc: &PdfDocumentReference,
    page_export: &PdfPageExport,
) -> Result<(), String> {
    if page_export.elements.is_empty() {
        for shape in &page_export.shapes {
            add_shape_to_layer(current_layer, &page_export.page, shape)?;
        }
        add_images_to_layer(current_layer, &page_export.page, &page_export.images)?;
        add_texts_to_layer(current_layer, doc, &page_export.page, &page_export.texts)?;
    } else {
        add_renderable_elements_to_layer(
            current_layer,
            doc,
            &page_export.page,
            &page_export.elements,
        )?;
    }

    Ok(())
}

impl PdfTextElement {
    fn visible_font_size(&self) -> f64 {
        if self.font_size > 0.0 {
            self.font_size
        } else {
            12.0
        }
    }

    fn visible_letter_spacing_em(&self) -> f64 {
        // Frontend Fabric uses `charSpacing = letterSpacing * 1000`, so the stored
        // value is an em fraction. PDF character spacing is expressed in text-space
        // units, effectively points at the active font size, so callers multiply by
        // font size when emitting and by font-size-mm when measuring.
        let value = self.letter_spacing.unwrap_or(0.0);
        if value.is_finite() {
            value
        } else {
            0.0
        }
    }

    fn line_height_mm(&self) -> f64 {
        self.visible_font_size() * 1.2 * PT_TO_MM
    }
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
    add_page_content_to_layer(&current_layer, &doc, first)?;

    for page_export in pages.iter().skip(1) {
        let (page, layer) = doc.add_page(
            Mm(page_export.page.width_mm as f32),
            Mm(page_export.page.height_mm as f32),
            "Layer 1",
        );
        let current_layer = doc.get_page(page).get_layer(layer);
        add_background_to_layer(&current_layer, &page_export.page);
        add_page_content_to_layer(&current_layer, &doc, page_export)?;
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
            texts: vec![],
            shapes: vec![],
            elements: vec![],
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
            texts: vec![],
            shapes: vec![],
            elements: vec![],
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
            texts: vec![],
            shapes: vec![],
            elements: vec![],
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
            texts: vec![],
            shapes: vec![],
            elements: vec![],
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

    fn pdf_text(overrides: impl FnOnce(&mut PdfTextElement)) -> PdfTextElement {
        let mut text = PdfTextElement {
            content: "März Grüße äußern fürs Öl".to_string(),
            x_mm: 10.0,
            y_mm: 20.0,
            width_mm: 60.0,
            height_mm: 30.0,
            rotation_deg: 0.0,
            font_family: "Inter, Noto Sans, Arial, Helvetica, sans-serif".to_string(),
            font_size: 12.0,
            color: "#111111".to_string(),
            font_weight: Some("400".to_string()),
            text_align: Some("left".to_string()),
            letter_spacing: Some(0.0),
        };
        overrides(&mut text);
        text
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

    #[test]
    fn test_pdf_font_family_and_weight_fallbacks() {
        assert_eq!(
            resolve_pdf_font_face(
                "Inter, Noto Sans, Arial, Helvetica, sans-serif",
                Some("700")
            ),
            PdfFontFace::HelveticaBold
        );
        assert_eq!(
            resolve_pdf_font_face("Courier New, Courier, monospace", Some("400")),
            PdfFontFace::Courier
        );
        assert_eq!(
            resolve_pdf_font_face("Georgia, Times New Roman, serif", Some("bold")),
            PdfFontFace::TimesBold
        );
        assert_eq!(
            resolve_pdf_font_face("\"Caveat\", cursive", Some("400")),
            PdfFontFace::Caveat
        );
    }

    #[test]
    fn test_multiline_text_layout_wraps_and_aligns_inside_box() {
        let text = pdf_text(|text| {
            text.content = "Januar 2027\nMo Di Mi Do Fr Sa So\n1 2 3 4 5 6 7".to_string();
            text.width_mm = 80.0;
            text.height_mm = 24.0;
            text.text_align = Some("center".to_string());
            text.letter_spacing = Some(0.25);
        });

        let lines = layout_text_lines(&text, PdfFontFace::Helvetica);

        assert!(lines.len() >= 3, "expected explicit date-grid line breaks");
        assert_eq!(lines[0].content, "Januar 2027");
        assert_eq!(lines[1].content, "Mo Di Mi Do Fr Sa So");
        assert!(lines.iter().all(|line| line.x_mm >= text.x_mm));
        assert!(
            lines
                .last()
                .map(|line| line.baseline_y_mm <= text.y_mm + text.height_mm)
                .unwrap_or(false),
            "layout should fit within the textbox height"
        );
    }

    #[test]
    fn test_date_grid_layout_preserves_leading_and_repeated_spaces() {
        let text = pdf_text(|text| {
            text.content =
                "Mo Di Mi Do Fr Sa So\n 1  2  3  4  5  6  7\n 8  9 10 11 12 13 14".to_string();
            text.width_mm = 160.0;
            text.height_mm = 45.0;
            text.font_family = "Courier New, Courier, monospace".to_string();
            text.font_size = 10.0;
        });

        let lines = layout_text_lines(&text, PdfFontFace::Courier);

        assert_eq!(lines.len(), 3);
        assert_eq!(lines[1].content, " 1  2  3  4  5  6  7");
        assert_eq!(lines[2].content, " 8  9 10 11 12 13 14");
    }

    #[test]
    fn test_wrapping_preserves_input_spaces_without_collapsing() {
        let text = pdf_text(|text| {
            text.content = " Alpha  Beta   Gamma".to_string();
            text.width_mm = 32.0;
            text.height_mm = 40.0;
        });

        let joined = layout_text_lines(&text, PdfFontFace::Helvetica)
            .into_iter()
            .map(|line| line.content)
            .collect::<Vec<_>>()
            .join("");

        assert_eq!(joined, text.content);
    }

    #[test]
    fn test_letter_spacing_uses_fabric_em_units_for_measurement() {
        let mut compact = pdf_text(|text| {
            text.content = "AB".to_string();
            text.font_size = 10.0;
            text.letter_spacing = Some(0.0);
        });
        let mut spaced = compact.clone();
        spaced.letter_spacing = Some(0.2);

        let compact_width =
            approximate_text_width_mm(&compact.content, &compact, PdfFontFace::Helvetica);
        let spaced_width =
            approximate_text_width_mm(&spaced.content, &spaced, PdfFontFace::Helvetica);
        let expected_extra_mm = 0.2 * 10.0 * PT_TO_MM;

        assert!(((spaced_width - compact_width) - expected_extra_mm).abs() < 1e-10);
        compact.letter_spacing = Some(0.2);
        assert_eq!(compact.visible_letter_spacing_em(), 0.2);
        compact.letter_spacing = Some(-0.1);
        assert_eq!(compact.visible_letter_spacing_em(), -0.1);
    }

    #[test]
    fn test_export_with_decorative_shape_and_text_layering() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#dce8d8".to_string()),
            }),
            images: vec![],
            texts: vec![],
            shapes: vec![],
            elements: vec![
                PdfRenderableElement::Shape(PdfShapeElement {
                    shape_kind: "rectangle".to_string(),
                    x_mm: 0.0,
                    y_mm: 0.0,
                    width_mm: 210.0,
                    height_mm: 24.0,
                    rotation_deg: 0.0,
                    fill: "#f4e7d3".to_string(),
                    stroke: "#c084fc".to_string(),
                    stroke_width: 0.7,
                    opacity: 1.0,
                }),
                PdfRenderableElement::Text(pdf_text(|text| {
                    text.content = "Kalender 2027".to_string();
                    text.x_mm = 20.0;
                    text.y_mm = 8.0;
                    text.width_mm = 170.0;
                    text.height_mm = 20.0;
                    text.text_align = Some("center".to_string());
                })),
            ],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(
            result.is_ok(),
            "Failed to export PDF with decorative shape/text: {:?}",
            result
        );

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
        assert!(pdf_bytes.len() > 1000, "PDF seems too small");
    }

    #[test]
    fn test_export_rotated_decorative_shape_uses_scoped_unrotated_fallback() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 100.0,
                height_mm: 100.0,
                background: Some("#ffffff".to_string()),
            }),
            images: vec![],
            texts: vec![],
            shapes: vec![],
            elements: vec![PdfRenderableElement::Shape(PdfShapeElement {
                shape_kind: "rectangle".to_string(),
                x_mm: 10.0,
                y_mm: 10.0,
                width_mm: 20.0,
                height_mm: 12.0,
                rotation_deg: 15.0,
                fill: "#f4e7d3".to_string(),
                stroke: "#1f2937".to_string(),
                stroke_width: 0.5,
                opacity: 1.0,
            })],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(
            result.is_ok(),
            "rotated shape should export via documented unrotated fallback: {:?}",
            result
        );

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
    }

    #[test]
    fn test_export_with_german_title_and_month_grid_text() {
        let output = NamedTempFile::new().unwrap();
        let output_path = output.path().to_str().unwrap().to_string();

        let request = PdfExportRequest {
            page: Some(PdfPageConfig {
                width_mm: 210.0,
                height_mm: 297.0,
                background: Some("#ffffff".to_string()),
            }),
            images: vec![],
            texts: vec![
                pdf_text(|text| {
                    text.content = "März Grüße 2027".to_string();
                    text.x_mm = 20.0;
                    text.y_mm = 18.0;
                    text.width_mm = 170.0;
                    text.height_mm = 20.0;
                    text.font_family = "\"Caveat\", cursive".to_string();
                    text.font_size = 28.0;
                    text.text_align = Some("center".to_string());
                }),
                pdf_text(|text| {
                    text.content =
                        "Mo Di Mi Do Fr Sa So\n 1  2  3  4  5  6  7\n 8  9 10 11 12 13 14"
                            .to_string();
                    text.x_mm = 25.0;
                    text.y_mm = 55.0;
                    text.width_mm = 160.0;
                    text.height_mm = 45.0;
                    text.font_family = "Courier New, Courier, monospace".to_string();
                    text.font_size = 10.0;
                    text.letter_spacing = Some(0.1);
                }),
            ],
            shapes: vec![],
            elements: vec![],
            pages: vec![],
            output_path: output_path.clone(),
        };

        let result = export_pdf(&request);
        assert!(
            result.is_ok(),
            "Failed to export PDF with German text/date grid: {:?}",
            result
        );

        let pdf_bytes = std::fs::read(&output_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"), "Output is not a valid PDF");
        assert!(pdf_bytes.len() > 1000, "PDF seems too small");
    }
}
