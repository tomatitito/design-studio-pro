use clap::{ArgGroup, Parser, Subcommand, ValueEnum};
use design_studio_pro_lib::core::pdf::{self, PdfExportRequest, PdfImageElement, PdfPageConfig};
use design_studio_pro_lib::core::project_io;
use design_studio_pro_lib::models::{
    Asset, Dimensions, Element, ElementType, MeasurementUnit, Orientation, Page, Position, Project,
    ProjectSettings, Size,
};
use design_studio_pro_lib::updater::{self, AutomaticUpdateOutcome, CheckOutcome, InstallOutcome};
use std::collections::HashSet;
use std::future::Future;
use std::path::Path;
use std::process;

#[derive(Parser)]
#[command(name = "dsp", about = "Design Studio Pro CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check for official CLI updates
    Update {
        #[command(subcommand)]
        command: UpdateCommands,
    },

    /// Download and install the latest official CLI release
    #[command(name = "self-update")]
    SelfUpdate,

    /// List available background presets
    Backgrounds,

    /// Create a new .dsproj project file
    #[command(
        group(
            ArgGroup::new("border_spec")
                .args(["border_style", "border_color", "border_width"])
                .multiple(true)
        ),
        after_help = "Examples:\n  dsp new --size a4 --add-image img1.png --output out.dsproj\n  dsp new --add-image img1.png --add-image img2.png --border-style ornate-gold --all-images -o framed.dsproj\n  dsp new --add-image img1.png --add-image img2.png --border-color \"#00aa55\" --border-width 2 --image-index 1 -o out.dsproj"
    )]
    New {
        /// Project name
        #[arg(long, default_value = "Untitled")]
        name: String,

        /// Page size: a4, letter, or WxH in mm (e.g. 200x300)
        #[arg(long, default_value = "a4")]
        size: String,

        /// Orientation: portrait or landscape
        #[arg(long, default_value = "portrait")]
        orientation: String,

        /// Image file(s) to place on the page (repeatable)
        #[arg(long = "add-image")]
        add_image: Vec<String>,

        /// Position in mm as X,Y for each --add-image (repeatable)
        #[arg(long)]
        position: Vec<String>,

        /// Size in mm as W,H or W for each --add-image (repeatable, default: auto)
        #[arg(long = "image-size")]
        image_size: Vec<String>,

        /// Output .dsproj file path
        #[arg(long, short)]
        output: String,

        /// Page background preset, solid hex, or linear-gradient(...)
        #[arg(long, default_value = "paper-white")]
        background: String,

        /// Border color to apply to image(s), e.g. #ff0000
        #[arg(long = "border-color")]
        border_color: Option<String>,

        /// Border width to apply to image(s)
        #[arg(long = "border-width")]
        border_width: Option<f64>,

        /// Border style preset
        #[arg(long = "border-style", value_enum)]
        border_style: Option<BorderStylePreset>,

        /// Zero-based image index to target (repeatable)
        #[arg(
            long = "image-index",
            conflicts_with = "all_images",
            requires = "border_spec"
        )]
        image_index: Vec<usize>,

        /// Apply border to all images
        #[arg(long = "all-images", default_value_t = false, requires = "border_spec")]
        all_images: bool,
    },

    /// Open an existing project, optionally add images, and save
    #[command(
        group(
            ArgGroup::new("border_spec")
                .args(["border_style", "border_color", "border_width"])
                .multiple(true)
        ),
        after_help = "Examples:\n  dsp open project.dsproj --background sunset-bloom\n  dsp open project.dsproj --border-style walnut-frame --all-images\n  dsp open project.dsproj --border-color \"#111111\" --border-width 3 --image-index 0"
    )]
    Open {
        /// Path to .dsproj file
        project: String,

        /// Image file(s) to add (repeatable)
        #[arg(long = "add-image")]
        add_image: Vec<String>,

        /// Position in mm as X,Y for each --add-image (repeatable)
        #[arg(long)]
        position: Vec<String>,

        /// Size in mm as W,H or W for each --add-image (repeatable, default: auto)
        #[arg(long = "image-size")]
        image_size: Vec<String>,

        /// Output .dsproj path (defaults to overwriting input)
        #[arg(long, short)]
        output: Option<String>,

        /// Page background preset, solid hex, or linear-gradient(...)
        #[arg(long)]
        background: Option<String>,

        /// Border color to apply to image(s), e.g. #ff0000
        #[arg(long = "border-color")]
        border_color: Option<String>,

        /// Border width to apply to image(s)
        #[arg(long = "border-width")]
        border_width: Option<f64>,

        /// Border style preset
        #[arg(long = "border-style", value_enum)]
        border_style: Option<BorderStylePreset>,

        /// Zero-based image index to target (repeatable)
        #[arg(
            long = "image-index",
            conflicts_with = "all_images",
            requires = "border_spec"
        )]
        image_index: Vec<usize>,

        /// Apply border to all images
        #[arg(long = "all-images", default_value_t = false, requires = "border_spec")]
        all_images: bool,
    },

    /// Export a project or ad-hoc images to PDF
    ExportPdf {
        /// Path to .dsproj file (optional; omit for ad-hoc mode)
        project: Option<String>,

        /// Page size for ad-hoc mode: a4, letter, or WxH in mm
        #[arg(long)]
        page_size: Option<String>,

        /// Image file(s) for ad-hoc export (repeatable)
        #[arg(long)]
        image: Vec<String>,

        /// Position in mm as X,Y for each --image (repeatable)
        #[arg(long)]
        position: Vec<String>,

        /// Size in mm as W,H or W for each --image (repeatable, default: auto)
        #[arg(long = "image-size")]
        image_size: Vec<String>,

        /// Output PDF path
        #[arg(long, short)]
        output: String,

        /// Page background preset, solid hex, or linear-gradient(...)
        #[arg(long, default_value = "paper-white")]
        background: String,
    },
}

#[derive(Subcommand)]
enum UpdateCommands {
    /// Check whether a newer official CLI release exists
    Check,
}

const BACKGROUND_PRESETS: [(&str, &str); 8] = [
    ("paper-white", "#ffffff"),
    ("sandstone", "#f4e7d3"),
    ("sage", "#dce8d8"),
    ("midnight-ink", "#22304a"),
    (
        "sunset-bloom",
        "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #7c3aed 100%)",
    ),
    (
        "ocean-mist",
        "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
    ),
    (
        "golden-hour",
        "linear-gradient(160deg, #fff7cc 0%, #fbbf24 45%, #fb7185 100%)",
    ),
    (
        "forest-haze",
        "linear-gradient(145deg, #1f4d3a 0%, #7dd3a7 100%)",
    ),
];

#[derive(Debug, Clone)]
enum BorderTarget {
    All,
    Indices(Vec<usize>),
}

#[derive(Debug, Clone)]
struct BorderStyle {
    style: String,
    color: String,
    width: f64,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum BorderStylePreset {
    Custom,
    MatteFrame,
    GalleryFrame,
    OrnateGold,
    WalnutFrame,
}

fn resolve_background_spec(input: &str) -> String {
    BACKGROUND_PRESETS
        .iter()
        .find(|(name, _)| *name == input.trim())
        .map(|(_, spec)| (*spec).to_string())
        .unwrap_or_else(|| input.trim().to_string())
}

/// Parse a page size string into (width_mm, height_mm).
fn parse_page_size(s: &str) -> Result<(f64, f64), String> {
    match s.to_lowercase().as_str() {
        "a4" => Ok((210.0, 297.0)),
        "letter" => Ok((215.9, 279.4)),
        other => {
            let parts: Vec<&str> = other.split('x').collect();
            if parts.len() != 2 {
                return Err(format!(
                    "Invalid page size '{}'. Use 'a4', 'letter', or WxH (e.g. 200x300)",
                    s
                ));
            }
            let w = parts[0]
                .parse::<f64>()
                .map_err(|_| format!("Invalid width in '{}'", s))?;
            let h = parts[1]
                .parse::<f64>()
                .map_err(|_| format!("Invalid height in '{}'", s))?;
            Ok((w, h))
        }
    }
}

/// Parse "X,Y" into (f64, f64).
fn parse_position(s: &str) -> Result<(f64, f64), String> {
    let parts: Vec<&str> = s.split(',').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid position '{}'. Use X,Y (e.g. 10,20)", s));
    }
    let x = parts[0]
        .trim()
        .parse::<f64>()
        .map_err(|_| format!("Invalid X in position '{}'", s))?;
    let y = parts[1]
        .trim()
        .parse::<f64>()
        .map_err(|_| format!("Invalid Y in position '{}'", s))?;
    Ok((x, y))
}

/// Parse "W,H" or a single "W" into dimensions.
/// A single value means "width only" — height will be resolved from aspect ratio later.
/// Returns (width, height) where height is 0.0 as a sentinel for "derive from aspect ratio".
fn parse_size(s: &str) -> Result<(f64, f64), String> {
    let parts: Vec<&str> = s.split(',').collect();
    match parts.len() {
        1 => {
            let w = parts[0]
                .trim()
                .parse::<f64>()
                .map_err(|_| format!("Invalid width in size '{}'", s))?;
            Ok((w, 0.0))
        }
        2 => {
            let w = parts[0]
                .trim()
                .parse::<f64>()
                .map_err(|_| format!("Invalid width in size '{}'", s))?;
            let h = parts[1]
                .trim()
                .parse::<f64>()
                .map_err(|_| format!("Invalid height in size '{}'", s))?;
            Ok((w, h))
        }
        _ => Err(format!(
            "Invalid size '{}'. Use W,H or W (e.g. 50,80 or 100)",
            s
        )),
    }
}

/// Get image dimensions in mm at 72 DPI, or fall back to a default.
fn auto_image_size_mm(image_path: &str) -> (f64, f64) {
    match image::image_dimensions(image_path) {
        Ok((w, h)) => {
            let w_mm = w as f64 * 25.4 / 72.0;
            let h_mm = h as f64 * 25.4 / 72.0;
            (w_mm, h_mm)
        }
        Err(_) => (50.0, 50.0),
    }
}

/// Resolve image size: use explicit if provided, otherwise auto-detect.
/// When a single width value is given (height sentinel = 0.0), derive height from aspect ratio.
fn resolve_image_size(explicit: Option<&String>, image_path: &str) -> Result<(f64, f64), String> {
    match explicit {
        Some(s) => {
            let (w, h) = parse_size(s)?;
            if h == 0.0 {
                // Single-value mode: derive height from image aspect ratio
                let (auto_w, auto_h) = auto_image_size_mm(image_path);
                let aspect = if auto_w > 0.0 { auto_h / auto_w } else { 1.0 };
                Ok((w, w * aspect))
            } else {
                Ok((w, h))
            }
        }
        None => Ok(auto_image_size_mm(image_path)),
    }
}

/// Build a PdfImageElement from image path, position, and size.
fn build_pdf_image(image_path: &str, pos: (f64, f64), size: (f64, f64)) -> PdfImageElement {
    PdfImageElement {
        image_path: image_path.to_string(),
        x_mm: pos.0,
        y_mm: pos.1,
        width_mm: size.0,
        height_mm: size.1,
        rotation_deg: 0.0,
        border_style: None,
        border_color: None,
        border_width: None,
    }
}

fn build_pdf_image_from_project_element(
    resolved_path: String,
    el: &Element,
) -> Option<PdfImageElement> {
    if let ElementType::Image {
        border_style,
        border_color,
        border_width,
        ..
    } = &el.element_type
    {
        Some(PdfImageElement {
            image_path: resolved_path,
            x_mm: el.position.x,
            y_mm: el.position.y,
            width_mm: el.size.width,
            height_mm: el.size.height,
            rotation_deg: el.rotation,
            border_style: border_style.clone(),
            border_color: border_color.clone(),
            border_width: *border_width,
        })
    } else {
        None
    }
}

/// Build an Element model for a project image.
fn build_element(index: usize, image_path: &str, pos: (f64, f64), size: (f64, f64)) -> Element {
    Element {
        id: format!("elem-{}", uuid::Uuid::new_v4()),
        element_type: ElementType::Image {
            src: image_path.to_string(),
            alt: Path::new(image_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image")
                .to_string(),
            border_style: None,
            border_color: None,
            border_width: None,
        },
        position: Position { x: pos.0, y: pos.1 },
        size: Size {
            width: size.0,
            height: size.1,
        },
        rotation: 0.0,
        opacity: 1.0,
        z_index: index as i32,
        locked: false,
        visible: true,
    }
}

/// Build an Asset from an image file path.
fn build_asset(image_path: &str) -> Asset {
    let path = Path::new(image_path);
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    let file_size = std::fs::metadata(image_path).map(|m| m.len()).unwrap_or(0);
    let dims = image::image_dimensions(image_path).ok();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime_type = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
    .to_string();

    Asset {
        id: format!("asset-{}", uuid::Uuid::new_v4()),
        name,
        file_path: std::fs::canonicalize(image_path)
            .unwrap_or_else(|_| path.to_path_buf())
            .to_string_lossy()
            .to_string(),
        thumbnail_path: None,
        file_size,
        mime_type,
        dimensions: dims.map(|(w, h)| Dimensions {
            width: w,
            height: h,
        }),
        created_at: chrono::Utc::now().to_rfc3339(),
    }
}

fn parse_orientation(s: &str) -> Result<Orientation, String> {
    match s.to_lowercase().as_str() {
        "portrait" => Ok(Orientation::Portrait),
        "landscape" => Ok(Orientation::Landscape),
        _ => Err(format!(
            "Invalid orientation '{}'. Use 'portrait' or 'landscape'",
            s
        )),
    }
}

fn preset_border_style(style_name: BorderStylePreset) -> BorderStyle {
    match style_name {
        BorderStylePreset::Custom => BorderStyle {
            style: "custom".to_string(),
            color: "#000000".to_string(),
            width: 1.0,
        },
        BorderStylePreset::MatteFrame => BorderStyle {
            style: "matte-frame".to_string(),
            color: "#f5f1e8".to_string(),
            width: 12.0,
        },
        BorderStylePreset::GalleryFrame => BorderStyle {
            style: "gallery-frame".to_string(),
            color: "#1f2937".to_string(),
            width: 6.0,
        },
        BorderStylePreset::OrnateGold => BorderStyle {
            style: "ornate-gold".to_string(),
            color: "#d4af37".to_string(),
            width: 8.0,
        },
        BorderStylePreset::WalnutFrame => BorderStyle {
            style: "walnut-frame".to_string(),
            color: "#5c3a21".to_string(),
            width: 10.0,
        },
    }
}

fn resolve_border_style(
    border_style: Option<BorderStylePreset>,
    border_color: Option<String>,
    border_width: Option<f64>,
) -> Result<Option<BorderStyle>, String> {
    let mut resolved = match border_style {
        Some(style_name) => Some(preset_border_style(style_name)),
        None => {
            if border_color.is_some() || border_width.is_some() {
                Some(BorderStyle {
                    style: "custom".to_string(),
                    color: "#000000".to_string(),
                    width: 1.0,
                })
            } else {
                None
            }
        }
    };

    if let Some(style) = resolved.as_mut() {
        if let Some(color) = border_color {
            style.color = color;
        }
        if let Some(width) = border_width {
            if width < 0.0 {
                return Err("Border width cannot be negative".to_string());
            }
            style.width = width;
        }
    }

    Ok(resolved)
}

fn resolve_border_target(
    indices: Vec<usize>,
    all_images: bool,
) -> Result<Option<BorderTarget>, String> {
    if all_images && !indices.is_empty() {
        return Err(
            "Cannot combine --all-images with one or more --image-index values".to_string(),
        );
    }
    if all_images {
        return Ok(Some(BorderTarget::All));
    }
    if indices.is_empty() {
        Ok(None)
    } else {
        Ok(Some(BorderTarget::Indices(indices)))
    }
}

fn apply_border_to_images(
    elements: &mut [Element],
    target: BorderTarget,
    style: &BorderStyle,
) -> Result<(), String> {
    let image_positions: Vec<usize> = elements
        .iter()
        .enumerate()
        .filter_map(|(idx, element)| match element.element_type {
            ElementType::Image { .. } => Some(idx),
            _ => None,
        })
        .collect();

    let target_positions: Vec<usize> = match target {
        BorderTarget::All => image_positions,
        BorderTarget::Indices(indices) => {
            let mut unique = HashSet::new();
            let mut positions = Vec::new();
            for image_index in indices {
                if image_index >= image_positions.len() {
                    return Err(format!(
                        "Image index {} is out of range ({} images available)",
                        image_index,
                        image_positions.len()
                    ));
                }
                if unique.insert(image_index) {
                    positions.push(image_positions[image_index]);
                }
            }
            positions
        }
    };

    for element_index in target_positions {
        if let ElementType::Image {
            border_style,
            border_color,
            border_width,
            ..
        } = &mut elements[element_index].element_type
        {
            *border_style = Some(style.style.clone());
            *border_color = Some(style.color.clone());
            *border_width = Some(style.width);
        }
    }

    Ok(())
}

fn cmd_new(
    name: String,
    size: String,
    orientation: String,
    add_image: Vec<String>,
    positions: Vec<String>,
    image_sizes: Vec<String>,
    output: String,
    background: String,
    border_style: Option<BorderStylePreset>,
    border_color: Option<String>,
    border_width: Option<f64>,
    image_indices: Vec<usize>,
    all_images: bool,
) -> Result<(), String> {
    let (w, h) = parse_page_size(&size)?;
    let orient = parse_orientation(&orientation)?;

    let (page_w, page_h) = match orient {
        Orientation::Portrait => (w, h),
        Orientation::Landscape => (h, w),
    };

    let mut elements = Vec::new();
    let mut assets = Vec::new();
    let background = resolve_background_spec(&background);
    let border_style = resolve_border_style(border_style, border_color, border_width)?;
    let border_target = resolve_border_target(image_indices, all_images)?;

    for (i, img_path) in add_image.iter().enumerate() {
        if !Path::new(img_path).exists() {
            return Err(format!("Image file not found: {}", img_path));
        }

        let pos = match positions.get(i) {
            Some(p) => parse_position(p)?,
            None => (0.0, 0.0),
        };
        let sz = resolve_image_size(image_sizes.get(i), img_path)?;

        elements.push(build_element(i, img_path, pos, sz));
        assets.push(build_asset(img_path));
    }

    if let Some(style) = border_style {
        let target = border_target.unwrap_or(BorderTarget::All);
        apply_border_to_images(&mut elements, target, &style)?;
    } else if border_target.is_some() {
        return Err(
            "Border target provided without border style. Use --border-color and/or --border-width"
                .to_string(),
        );
    }

    let now = chrono::Utc::now().to_rfc3339();
    let project = Project {
        id: format!("proj-{}", uuid::Uuid::new_v4()),
        name,
        pages: vec![Page {
            id: format!("page-{}", uuid::Uuid::new_v4()),
            name: "Page 1".to_string(),
            elements,
            width: page_w,
            height: page_h,
            background_color: background,
            order: 0,
        }],
        created_at: now.clone(),
        modified_at: now,
        settings: ProjectSettings {
            width: page_w,
            height: page_h,
            orientation: orient,
            unit: MeasurementUnit::Mm,
        },
    };

    project_io::save_project(&output, &project, &assets)?;
    eprintln!("Created project: {}", output);
    Ok(())
}

fn cmd_open(
    project_path: String,
    add_image: Vec<String>,
    positions: Vec<String>,
    image_sizes: Vec<String>,
    output: Option<String>,
    background: Option<String>,
    border_style: Option<BorderStylePreset>,
    border_color: Option<String>,
    border_width: Option<f64>,
    image_indices: Vec<usize>,
    all_images: bool,
) -> Result<(), String> {
    let extract_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let loaded = project_io::load_project(&project_path, extract_dir.path().to_str().unwrap())?;

    let mut project = loaded.manifest.project;
    let mut assets: Vec<Asset> = loaded.manifest.assets;
    let border_style = resolve_border_style(border_style, border_color, border_width)?;
    let border_target = resolve_border_target(image_indices, all_images)?;

    if let Some(page) = project.pages.first_mut() {
        if let Some(background) = background {
            page.background_color = resolve_background_spec(&background);
        }
        let base_index = page.elements.len();
        for (i, img_path) in add_image.iter().enumerate() {
            if !Path::new(img_path).exists() {
                return Err(format!("Image file not found: {}", img_path));
            }

            let pos = match positions.get(i) {
                Some(p) => parse_position(p)?,
                None => (0.0, 0.0),
            };
            let sz = resolve_image_size(image_sizes.get(i), img_path)?;

            page.elements
                .push(build_element(base_index + i, img_path, pos, sz));
            assets.push(build_asset(img_path));
        }

        if let Some(style) = border_style {
            let target = border_target.unwrap_or(BorderTarget::All);
            apply_border_to_images(&mut page.elements, target, &style)?;
        } else if border_target.is_some() {
            return Err(
                "Border target provided without border style. Use --border-color and/or --border-width"
                    .to_string(),
            );
        }
    }

    project.modified_at = chrono::Utc::now().to_rfc3339();
    let out_path = output.unwrap_or(project_path);
    project_io::save_project(&out_path, &project, &assets)?;
    eprintln!("Saved project: {}", out_path);
    Ok(())
}

fn cmd_export_pdf(
    project: Option<String>,
    page_size: Option<String>,
    images: Vec<String>,
    positions: Vec<String>,
    image_sizes: Vec<String>,
    output: String,
    background: String,
) -> Result<(), String> {
    let background = resolve_background_spec(&background);
    if let Some(proj_path) = project {
        // Project mode: load .dsproj and export
        let extract_dir =
            tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;

        let loaded = project_io::load_project(&proj_path, extract_dir.path().to_str().unwrap())?;

        let proj = &loaded.manifest.project;
        let page = proj.pages.first().ok_or("Project has no pages")?;

        let pdf_images: Vec<PdfImageElement> = page
            .elements
            .iter()
            .filter_map(|el| {
                if let ElementType::Image { ref src, .. } = el.element_type {
                    // Resolve image path: check extracted assets first, then original
                    let resolved_path = loaded
                        .manifest
                        .assets
                        .iter()
                        .find(|a| {
                            Path::new(&a.file_path).file_name().and_then(|n| n.to_str())
                                == Path::new(src).file_name().and_then(|n| n.to_str())
                        })
                        .map(|a| a.file_path.clone())
                        .unwrap_or_else(|| src.clone());
                    build_pdf_image_from_project_element(resolved_path, el)
                } else {
                    None
                }
            })
            .collect();

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: page.width,
                height_mm: page.height,
                background: Some(page.background_color.clone()),
            },
            images: pdf_images,
            output_path: output.clone(),
        };

        pdf::export_pdf(&request)?;
        eprintln!("Exported PDF: {}", output);
    } else {
        // Ad-hoc mode
        let size_str = page_size.as_deref().unwrap_or("a4");
        let (w, h) = parse_page_size(size_str)?;

        let mut pdf_images = Vec::new();
        for (i, img_path) in images.iter().enumerate() {
            if !Path::new(img_path).exists() {
                return Err(format!("Image file not found: {}", img_path));
            }

            let pos = match positions.get(i) {
                Some(p) => parse_position(p)?,
                None => (0.0, 0.0),
            };
            let sz = resolve_image_size(image_sizes.get(i), img_path)?;
            pdf_images.push(build_pdf_image(img_path, pos, sz));
        }

        let request = PdfExportRequest {
            page: PdfPageConfig {
                width_mm: w,
                height_mm: h,
                background: Some(background),
            },
            images: pdf_images,
            output_path: output.clone(),
        };

        pdf::export_pdf(&request)?;
        eprintln!("Exported PDF: {}", output);
    }

    Ok(())
}

fn current_cli_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn run_async<T, F>(future: F) -> Result<T, String>
where
    F: Future<Output = Result<T, updater::UpdaterError>>,
{
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| format!("Failed to initialize updater runtime: {error}"))?;

    runtime.block_on(future).map_err(|error| error.to_string())
}

fn cmd_update_check() -> Result<(), String> {
    match run_async(updater::check_for_updates(current_cli_version(), true))? {
        CheckOutcome::UpToDate { .. } => {
            eprintln!("dsp is up to date.");
            Ok(())
        }
        CheckOutcome::UpdateAvailable {
            current_version,
            latest_version,
            official_install,
            ..
        } => {
            eprintln!(
                "A new version of dsp is available: {latest_version} (current: {current_version})."
            );
            if !official_install {
                eprintln!(
                    "Self-update is supported only for the official install location. Reinstall from the official release to enable it."
                );
            }
            Ok(())
        }
    }
}

fn cmd_self_update() -> Result<(), String> {
    match run_async(updater::self_update(current_cli_version()))? {
        InstallOutcome::UpToDate { .. } => {
            eprintln!("dsp is up to date.");
            Ok(())
        }
        InstallOutcome::Installed { new_version, .. }
        | InstallOutcome::StagedWindowsReplacement { new_version, .. } => {
            eprintln!("Updated dsp to {new_version}.");
            Ok(())
        }
    }
}

fn should_run_startup_update(command: &Commands) -> bool {
    !matches!(command, Commands::Update { .. } | Commands::SelfUpdate)
}

fn maybe_run_startup_update(command: &Commands) {
    if !should_run_startup_update(command) {
        return;
    }

    match run_async(updater::automatic_startup_update(current_cli_version())) {
        Ok(AutomaticUpdateOutcome::Updated {
            previous_version,
            new_version,
        }) => {
            eprintln!(
                "A new version of dsp is available: {new_version} (current: {previous_version}). Downloading and installing update..."
            );
            eprintln!("Updated dsp to {new_version}.");
        }
        Ok(AutomaticUpdateOutcome::UpdateFailed {
            current_version,
            latest_version,
            reason,
            ..
        }) => {
            eprintln!(
                "A new version of dsp is available, but automatic update failed: {reason}. Run 'dsp self-update' or reinstall from the official release."
            );
            log::debug!(
                "automatic update failed for current version {} -> {}: {}",
                current_version,
                latest_version,
                reason
            );
        }
        Ok(AutomaticUpdateOutcome::UpdateAvailable {
            current_version,
            latest_version,
            official_install,
        }) => {
            eprintln!(
                "A new version of dsp is available: {latest_version} (current: {current_version})."
            );
            if !official_install {
                eprintln!(
                    "Automatic install is only supported for the official install location. Reinstall from the official release to enable self-update."
                );
            }
        }
        Ok(AutomaticUpdateOutcome::Disabled)
        | Ok(AutomaticUpdateOutcome::SkippedCooldown)
        | Ok(AutomaticUpdateOutcome::UpToDate { .. }) => {}
        Err(error) => {
            log::debug!("automatic update check failed: {}", error);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_image_element(id: &str) -> Element {
        Element {
            id: id.to_string(),
            element_type: ElementType::Image {
                src: format!("/tmp/{}.png", id),
                alt: id.to_string(),
                border_style: None,
                border_color: None,
                border_width: None,
            },
            position: Position { x: 0.0, y: 0.0 },
            size: Size {
                width: 50.0,
                height: 30.0,
            },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        }
    }

    #[test]
    fn apply_border_targets_single_image_by_index() {
        let mut elements = vec![
            sample_image_element("image-1"),
            sample_image_element("image-2"),
        ];

        apply_border_to_images(
            &mut elements,
            BorderTarget::Indices(vec![0]),
            &BorderStyle {
                style: "custom".to_string(),
                color: "#ff0000".to_string(),
                width: 2.0,
            },
        )
        .unwrap();

        let first = &elements[0];
        let second = &elements[1];
        match &first.element_type {
            ElementType::Image {
                border_style,
                border_color,
                border_width,
                ..
            } => {
                assert_eq!(border_style.as_deref(), Some("custom"));
                assert_eq!(border_color.as_deref(), Some("#ff0000"));
                assert_eq!(*border_width, Some(2.0));
            }
            _ => panic!("expected image"),
        }
        match &second.element_type {
            ElementType::Image {
                border_color,
                border_width,
                ..
            } => {
                assert_eq!(border_color, &None);
                assert_eq!(border_width, &None);
            }
            _ => panic!("expected image"),
        }
    }

    #[test]
    fn apply_border_targets_multiple_images_by_indices() {
        let mut elements = vec![
            sample_image_element("image-1"),
            sample_image_element("image-2"),
        ];

        apply_border_to_images(
            &mut elements,
            BorderTarget::Indices(vec![0, 1]),
            &BorderStyle {
                style: "custom".to_string(),
                color: "#00ff00".to_string(),
                width: 4.0,
            },
        )
        .unwrap();

        for element in &elements {
            match &element.element_type {
                ElementType::Image {
                    border_color,
                    border_width,
                    ..
                } => {
                    assert_eq!(border_color.as_deref(), Some("#00ff00"));
                    assert_eq!(*border_width, Some(4.0));
                }
                _ => panic!("expected image"),
            }
        }
    }

    #[test]
    fn apply_border_targets_all_images() {
        let mut elements = vec![
            sample_image_element("image-1"),
            sample_image_element("image-2"),
        ];

        apply_border_to_images(
            &mut elements,
            BorderTarget::All,
            &BorderStyle {
                style: "custom".to_string(),
                color: "#0000ff".to_string(),
                width: 1.5,
            },
        )
        .unwrap();

        for element in &elements {
            match &element.element_type {
                ElementType::Image {
                    border_color,
                    border_width,
                    ..
                } => {
                    assert_eq!(border_color.as_deref(), Some("#0000ff"));
                    assert_eq!(*border_width, Some(1.5));
                }
                _ => panic!("expected image"),
            }
        }
    }

    #[test]
    fn resolve_border_style_uses_frame_preset_defaults() {
        let style = resolve_border_style(Some(BorderStylePreset::MatteFrame), None, None).unwrap();
        let style = style.expect("expected style");
        assert_eq!(style.style, "matte-frame");
        assert_eq!(style.color, "#f5f1e8");
        assert_eq!(style.width, 12.0);
    }

    #[test]
    fn build_pdf_image_from_project_element_keeps_border_fields() {
        let el = Element {
            id: "image-1".to_string(),
            element_type: ElementType::Image {
                src: "/tmp/image-1.png".to_string(),
                alt: "image-1".to_string(),
                border_style: Some("ornate-gold".to_string()),
                border_color: Some("#d4af37".to_string()),
                border_width: Some(8.0),
            },
            position: Position { x: 12.0, y: 34.0 },
            size: Size {
                width: 56.0,
                height: 78.0,
            },
            rotation: 0.0,
            opacity: 1.0,
            z_index: 0,
            locked: false,
            visible: true,
        };

        let mapped = build_pdf_image_from_project_element("/tmp/extracted.png".to_string(), &el)
            .expect("expected pdf image");

        assert_eq!(mapped.border_style.as_deref(), Some("ornate-gold"));
        assert_eq!(mapped.border_color.as_deref(), Some("#d4af37"));
        assert_eq!(mapped.border_width, Some(8.0));
    }
}

fn main() {
    let cli = Cli::parse();
    maybe_run_startup_update(&cli.command);

    let result = match cli.command {
        Commands::Update { command } => match command {
            UpdateCommands::Check => cmd_update_check(),
        },
        Commands::SelfUpdate => cmd_self_update(),
        Commands::Backgrounds => {
            for (name, spec) in BACKGROUND_PRESETS {
                println!("{name}\t{spec}");
            }
            Ok(())
        }
        Commands::New {
            name,
            size,
            orientation,
            add_image,
            position,
            image_size,
            output,
            background,
            border_style,
            border_color,
            border_width,
            image_index,
            all_images,
        } => cmd_new(
            name,
            size,
            orientation,
            add_image,
            position,
            image_size,
            output,
            background,
            border_style,
            border_color,
            border_width,
            image_index,
            all_images,
        ),

        Commands::Open {
            project,
            add_image,
            position,
            image_size,
            output,
            background,
            border_style,
            border_color,
            border_width,
            image_index,
            all_images,
        } => cmd_open(
            project,
            add_image,
            position,
            image_size,
            output,
            background,
            border_style,
            border_color,
            border_width,
            image_index,
            all_images,
        ),

        Commands::ExportPdf {
            project,
            page_size,
            image,
            position,
            image_size,
            output,
            background,
        } => cmd_export_pdf(
            project, page_size, image, position, image_size, output, background,
        ),
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        process::exit(1);
    }
}
