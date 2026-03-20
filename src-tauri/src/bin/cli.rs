use clap::{Parser, Subcommand};
use design_studio_pro_lib::core::pdf::{self, PdfExportRequest, PdfImageElement, PdfPageConfig};
use design_studio_pro_lib::core::project_io;
use design_studio_pro_lib::models::{
    Asset, Dimensions, Element, ElementType, MeasurementUnit, Orientation, Page, Position, Project,
    ProjectSettings, Size,
};
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
    /// List available background presets
    Backgrounds,

    /// Create a new .dsproj project file
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
    },

    /// Open an existing project, optionally add images, and save
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

fn cmd_new(
    name: String,
    size: String,
    orientation: String,
    add_image: Vec<String>,
    positions: Vec<String>,
    image_sizes: Vec<String>,
    output: String,
    background: String,
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
) -> Result<(), String> {
    let extract_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let loaded = project_io::load_project(&project_path, extract_dir.path().to_str().unwrap())?;

    let mut project = loaded.manifest.project;
    let mut assets: Vec<Asset> = loaded.manifest.assets;

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

                    Some(PdfImageElement {
                        image_path: resolved_path,
                        x_mm: el.position.x,
                        y_mm: el.position.y,
                        width_mm: el.size.width,
                        height_mm: el.size.height,
                        rotation_deg: el.rotation,
                    })
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

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
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
        } => cmd_new(
            name,
            size,
            orientation,
            add_image,
            position,
            image_size,
            output,
            background,
        ),

        Commands::Open {
            project,
            add_image,
            position,
            image_size,
            output,
            background,
        } => cmd_open(project, add_image, position, image_size, output, background),

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
