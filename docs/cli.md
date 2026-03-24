# DSP CLI Reference

`dsp` is the command-line interface for Design Studio Pro. It provides headless/scripted access to project management and PDF export without launching the GUI.

## Building

```bash
cd src-tauri
cargo build --features cli
# Binary: target/debug/dsp
```

For a release build:

```bash
cargo build --release --features cli
# Binary: target/release/dsp
```

## Subcommands

### `dsp backgrounds` — List background presets

Prints the built-in background preset names and the spec each one resolves to.

```bash
dsp backgrounds
```

### `dsp new` — Create a new project

Creates a new `.dsproj` project file with optional images.

```
dsp new [OPTIONS] --output <PATH>
```

**Options:**

| Option                                | Description                                             | Default       |
| ------------------------------------- | ------------------------------------------------------- | ------------- |
| `--name <NAME>`                       | Project name                                            | `Untitled`    |
| `--size <SIZE>`                       | Page size: `a4`, `letter`, or `WxH` in mm               | `a4`          |
| `--orientation <portrait\|landscape>` | Page orientation                                        | `portrait`    |
| `--add-image <PATH>`                  | Image file to place (repeatable)                        | —             |
| `--position <X,Y>`                    | Position in mm for preceding image                      | `0,0`         |
| `--image-size <W,H>`                  | Size in mm for preceding image                          | auto          |
| `--background <SPEC>`                 | Background preset, hex color, or `linear-gradient(...)` | `paper-white` |
| `--border-style <STYLE>`              | Border style preset (`custom`, `matte-frame`, `gallery-frame`, `ornate-gold`, `walnut-frame`) | — |
| `--border-color <HEX>`                | Border color to apply to images                          | —             |
| `--border-width <N>`                  | Border width to apply to images                          | —             |
| `--image-index <N>`                   | Zero-based image index to target (repeatable)            | —             |
| `--all-images`                        | Apply border to all images                               | false         |
| `-o, --output <PATH>`                 | Output `.dsproj` path (required)                        | —             |

**Examples:**

```bash
# Empty A4 project
dsp new --name "My Design" --output project.dsproj

# A4 landscape with an image at position 10,20
dsp new --name "Poster" --size a4 --orientation landscape \
  --add-image photo.jpg --position 10,20 --output poster.dsproj

# Custom page size with multiple images
dsp new --size 200x300 \
  --add-image img1.png --position 10,10 --image-size 50,80 \
  --add-image img2.png --position 70,10 \
  --output multi.dsproj

# Photo sheet with a gradient background preset
dsp new --size a4 --background sunset-bloom --output gradient-sheet.dsproj

# Add red borders to every added image
dsp new --size a4 \
  --add-image img1.png --add-image img2.png \
  --border-color "#ff0000" --border-width 2 --all-images \
  --output bordered.dsproj

# Apply frame-like ornate style to all images
dsp new --size a4 \
  --add-image img1.png --add-image img2.png \
  --border-style ornate-gold --all-images \
  --output framed.dsproj
```

### `dsp open` — Open and modify a project

Opens an existing `.dsproj` file, optionally adds images, and saves.

```
dsp open <PROJECT> [OPTIONS]
```

**Options:**

| Option                | Description                                   | Default          |
| --------------------- | --------------------------------------------- | ---------------- |
| `<PROJECT>`           | Path to `.dsproj` file (positional, required) | —                |
| `--add-image <PATH>`  | Image file to add (repeatable)                | —                |
| `--position <X,Y>`    | Position in mm for preceding image            | `0,0`            |
| `--image-size <W,H>`  | Size in mm for preceding image                | auto             |
| `--background <SPEC>` | Replace the page background                   | unchanged        |
| `--border-style <STYLE>`| Border style preset (`custom`, `matte-frame`, `gallery-frame`, `ornate-gold`, `walnut-frame`) | — |
| `--border-color <HEX>`| Border color to apply to images               | —                |
| `--border-width <N>`  | Border width to apply to images               | —                |
| `--image-index <N>`   | Zero-based image index to target (repeatable) | —                |
| `--all-images`        | Apply border to all images                    | false            |
| `-o, --output <PATH>` | Output path                                   | overwrites input |

**Examples:**

```bash
# Add an image and save back
dsp open project.dsproj --add-image newphoto.jpg --position 50,50

# Add an image and save to a new file
dsp open project.dsproj --add-image logo.png --position 0,0 --output updated.dsproj

# Swap the photo sheet background to a custom gradient
dsp open project.dsproj \
  --background "linear-gradient(145deg, #1f4d3a 0%, #7dd3a7 100%)"

# Add border to one specific picture (image index 0)
dsp open project.dsproj --border-color "#111111" --border-width 3 --image-index 0

# Add border to multiple pictures (image indices 1 and 3)
dsp open project.dsproj \
  --border-color "#00aa55" --border-width 2 \
  --image-index 1 --image-index 3

# Add border to all pictures
dsp open project.dsproj --border-color "#ffffff" --border-width 1 --all-images

# Apply walnut frame preset to all pictures
dsp open project.dsproj --border-style walnut-frame --all-images
```

### `dsp export-pdf` — Export to PDF

Two modes of operation:

1. **From project:** Load a `.dsproj` and export all images to PDF.
2. **Ad-hoc:** Specify images directly without a project file.

```
dsp export-pdf [PROJECT] [OPTIONS] --output <PATH>
```

**Options:**

| Option                | Description                          | Default       |
| --------------------- | ------------------------------------ | ------------- |
| `<PROJECT>`           | Path to `.dsproj` file (optional)    | —             |
| `--page-size <SIZE>`  | Page size for ad-hoc mode            | `a4`          |
| `--image <PATH>`      | Image for ad-hoc export (repeatable) | —             |
| `--position <X,Y>`    | Position in mm for preceding image   | `0,0`         |
| `--image-size <W,H>`  | Size in mm for preceding image       | auto          |
| `--background <SPEC>` | Background for ad-hoc exports        | `paper-white` |
| `-o, --output <PATH>` | Output PDF path (required)           | —             |

**Examples:**

```bash
# Export a project to PDF
dsp export-pdf project.dsproj -o design.pdf

# Ad-hoc: single image on A4
dsp export-pdf --page-size a4 --image photo.jpg --position 10,20 -o output.pdf

# Ad-hoc: letter size with multiple images
dsp export-pdf --page-size letter \
  --image header.png --position 10,10 --image-size 195,40 \
  --image body.png --position 10,60 \
  -o layout.pdf

# Ad-hoc: export a gradient-backed photo sheet PDF
dsp export-pdf --page-size a4 --background ocean-mist -o sheet.pdf
```

## Background Specs

- Preset ids: `paper-white`, `sandstone`, `sage`, `midnight-ink`, `sunset-bloom`, `ocean-mist`, `golden-hour`, `forest-haze`
- Solid colors: hex values like `#ffffff` or `#22304a`
- Gradients: `linear-gradient(<angle>deg, <color> <stop>%, ...)`

Example:

```bash
dsp new \
  --background "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #7c3aed 100%)" \
  --output custom-gradient.dsproj
```

## Page Sizes

| Name     | Dimensions (mm)      |
| -------- | -------------------- |
| `a4`     | 210 x 297            |
| `letter` | 215.9 x 279.4        |
| Custom   | `WxH` e.g. `200x300` |

## Coordinate System

- All positions and sizes are in **millimeters**.
- Origin is at the **top-left** corner of the page.
- X increases to the right, Y increases downward.

## Auto Image Sizing

When `--image-size` is not specified, the image's pixel dimensions are converted to mm at **72 DPI**:

```
width_mm  = width_px  * 25.4 / 72
height_mm = height_px * 25.4 / 72
```

If the image dimensions cannot be read, a fallback of 50x50 mm is used.
