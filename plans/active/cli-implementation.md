# CLI for Design Studio Pro

## Context

Design Studio Pro is a Tauri desktop app (Rust backend + React frontend) for designing layouts and exporting to PDF. All core logic (PDF generation, project I/O, models) lives in `src-tauri/src/core/` and `src-tauri/src/models/`, cleanly separated from the Tauri IPC layer. We want a CLI binary that reuses this core logic directly, enabling headless/scripted workflows.

## Approach

Add a new binary target `dsp` to the existing `src-tauri` crate. This binary directly calls the existing `core::pdf::export_pdf()` and `core::project_io::*` functions — zero code duplication.

## Changes

### 1. Add `clap` dependency to `src-tauri/Cargo.toml`

```toml
clap = { version = "4", features = ["derive"], optional = true }

[features]
cli = ["clap"]

[[bin]]
name = "dsp"
path = "src/bin/cli.rs"
required-features = ["cli"]
```

Making `clap` optional via a feature flag keeps the Tauri GUI build lean.

### 2. Create `src-tauri/src/bin/cli.rs`

The CLI entry point using clap derive. Three subcommands:

```
dsp new --name "My Project" --size a4 --add-image photo.jpg --position 10,20 --output project.dsproj
dsp open project.dsproj --add-image photo.jpg --position 10,20 --output updated.dsproj
dsp export-pdf project.dsproj --output design.pdf
dsp export-pdf --page-size a4 --image photo.jpg --position 10,20 --output design.pdf
```

#### Subcommand: `new`
- `--name <NAME>`: Project name (default: "Untitled")
- `--size <SIZE>`: Page size preset — `a4`, `letter`, or `<W>x<H>` in mm (default: `a4`)
- `--orientation <portrait|landscape>`: Orientation (default: `portrait`)
- `--add-image <PATH>`: Image file to place (repeatable)
- `--position <X,Y>`: Position in mm for the preceding `--add-image` (default: `0,0`)
- `--image-size <W,H>`: Size in mm for the preceding image (default: auto from image dimensions)
- `--output <PATH>`: Output .dsproj file path (required)

#### Subcommand: `open`
- `<PROJECT>`: Path to .dsproj file (positional, required)
- `--add-image <PATH>`: Image file to add (repeatable)
- `--position <X,Y>`: Position in mm
- `--image-size <W,H>`: Size in mm
- `--output <PATH>`: Output .dsproj path (defaults to overwriting input)

#### Subcommand: `export-pdf`
Two modes:
1. **From project**: `dsp export-pdf project.dsproj -o output.pdf` — loads .dsproj, exports all images to PDF
2. **Direct/ad-hoc**: `dsp export-pdf --page-size a4 --image photo.jpg --position 10,20 -o output.pdf` — skip project, go straight to PDF

Options:
- `<PROJECT>`: Optional .dsproj file path
- `--page-size <SIZE>`: Page size (`a4`, `letter`, `<W>x<H>mm`), used if no project given
- `--image <PATH>`: Image to include (repeatable, for ad-hoc mode)
- `--position <X,Y>`: Position in mm for preceding image
- `--image-size <W,H>`: Size in mm for preceding image
- `-o, --output <PATH>`: Output PDF path (required)

### 3. Add documentation

#### `CLAUDE.md` (project root — create new)
Add a short "CLI" section with:
- How to build: `cd src-tauri && cargo build --features cli`
- Basic usage example: `dsp export-pdf`, `dsp new`, `dsp open`
- Link to `docs/cli.md` for full reference

#### `docs/cli.md` (new)
Full CLI reference documentation:
- Installation / building instructions
- All subcommands with all options documented
- Usage examples for each subcommand
- Notes on page size presets, coordinate system (mm, top-left origin), auto-sizing behavior

### 4. Files to modify/create

| File | Action |
|------|--------|
| `src-tauri/Cargo.toml` | Add `clap` dep, `cli` feature, `[[bin]]` target |
| `src-tauri/src/bin/cli.rs` | New — CLI entry point with clap definitions + subcommand dispatch |
| `CLAUDE.md` | New — project-level instructions with CLI section |
| `docs/cli.md` | New — full CLI reference documentation |

### 5. Core functions reused (no changes needed)

- `core::pdf::export_pdf(request)` — PDF generation (`src-tauri/src/core/pdf.rs`)
- `core::pdf::PdfExportRequest`, `PdfPageConfig`, `PdfImageElement` — data types
- `core::project_io::save_project()` — save .dsproj (`src-tauri/src/core/project_io.rs`)
- `core::project_io::load_project()` — load .dsproj
- `models::Project`, `Page`, `Element`, `Asset`, etc. (`src-tauri/src/models/`)

### 6. Helper logic needed in cli.rs

- **Page size parser**: Convert `"a4"` → `(210.0, 297.0)`, `"letter"` → `(215.9, 279.4)`, `"WxH"` → custom
- **Auto image sizing**: Read image dimensions via the `image` crate (already a dependency), convert px to mm at 72 DPI
- **Position parser**: Parse `"10,20"` into `(f64, f64)`
- **Element construction**: Build `Element` structs for images being added to projects

## Verification

1. `cd src-tauri && cargo build --features cli` — binary compiles
2. `cargo test` — existing tests still pass
3. Test ad-hoc PDF export:
   ```
   ./target/debug/dsp export-pdf --page-size a4 --image test.png --position 10,20 -o test.pdf
   ```
4. Test project creation:
   ```
   ./target/debug/dsp new --name "Test" --size a4 --add-image test.png --position 10,20 --output test.dsproj
   ```
5. Test project load + export:
   ```
   ./target/debug/dsp export-pdf test.dsproj -o test.pdf
   ```
