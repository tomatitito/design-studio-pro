# Vertical Slice: Image → Sheet → Resize → PDF - COMPLETED

Completed: 2026-02-25

Minimal end-to-end path through the application. A user can now:
1. Pick an image from their hard drive
2. Place it onto an image sheet
3. Resize/reposition it on the sheet
4. Export the result as a PDF

## Task 1: Wire image import to UI

- [x] Toolbar "Image" button click → calls `importImageViaDialog()`
- [x] Canvas container gets `onDragOver`/`onDrop` handlers using `getDroppedImageFiles()`
- [x] After import, create a `fabric.Image` object from the asset's file path (use `convertFileSrc`)
- [x] Place the image at center of viewport (dialog import) or at drop position (drag-and-drop)
- [x] Add the element to the current page in projectStore
- [x] Sync the new Fabric object with canvas handlers so selection/manipulation works immediately

## Task 2: Render a page sheet on canvas

- [x] Render a non-selectable white rectangle on the canvas matching page dimensions
- [x] Sheet stays centered and scales with zoom
- [x] Page-size picker dropdown in toolbar (A4, A3, Letter, Square 30×30cm)
- [x] Store the chosen page size in projectStore settings
- [x] Default A4 project created on startup

## Task 3: Minimal PDF export (Rust)

- [x] Added `printpdf = "0.7"` to Cargo.toml
- [x] Created `src-tauri/src/core/pdf.rs` with `export_pdf()` function
- [x] Supports JPEG (raw DCT) and PNG (decoded to RGB8) embedding
- [x] Handles coordinate conversion (top-left to bottom-left origin)
- [x] Added `export_pdf` Tauri command
- [x] Unit tests: empty page, single image, y-coordinate flipping

## Task 4: Export UI and frontend wiring

- [x] Created `src/canvas/export.ts` with `collectExportData()` and `exportPdf()`
- [x] Converts canvas pixel positions to mm relative to page sheet origin
- [x] "Export PDF" button in toolbar
- [x] Native save dialog with `.pdf` filter
- [x] Ctrl/Cmd+E keyboard shortcut
- [x] Stores `originalFilePath` on Fabric objects for export path resolution

## Task 5: Validation

- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 errors
- [x] `pnpm test` — 60/60 pass
- [x] `cargo check` — pass
- [x] `cargo test` — 180/180 pass

## Post-completion Fixes

### Fix 1: Image not appearing on canvas (2026-02-25)

Three issues prevented imported images from displaying:

1. **Asset protocol disabled** — `convertFileSrc()` returns an `asset://localhost/...` URL but Tauri's asset protocol wasn't enabled. Fixed by adding `assetProtocol: { enable: true, scope: ["**"] }` to `tauri.conf.json`.
2. **Default project had no pages** — `DEFAULT_PROJECT` in `Canvas.tsx` had `pages: []`, so image elements couldn't be persisted. Fixed by adding a default "Page 1".
3. **Silent error swallowing** — `void handleImageImport()` discarded the promise. Added `.catch()` and try/catch with console logging.

### Fix 2: Serde field name mismatch (2026-02-25)

Images still failed to appear because Rust structs serialized with snake_case (`file_path`, `mime_type`) but TypeScript interfaces expected camelCase (`filePath`, `mimeType`). `asset.filePath` was `undefined` on the frontend.

Fixed by adding `#[serde(rename_all = "camelCase")]` to all Rust models crossing the IPC boundary:
- `Asset`, `Project`, `Page`, `Element`, `ElementType`, `ThumbnailResult`, `ProjectManifest`
- `PdfPageConfig`, `PdfImageElement`, `PdfExportRequest`

Updated TypeScript PDF types in `export.ts` to match. Fixed pre-existing `this` typing issue in `App.test.tsx`.

### Fix 3: A4 sheet display and PDF export (2026-02-25)

Three issues with A4 format handling:

1. **Sheet not visually recognizable as A4** — A4 at 72 DPI is 595×842px, taller than most viewports. At 100% zoom only the top portion was visible, making it not look like A4. Fixed by adding `fitSheetInView()` to `sheet.ts` which auto-calculates a zoom level to fit the entire sheet within the viewport with 48px padding, then centers the view. Called on canvas init and when page size changes.

2. **PDF DPI double-scaling** — `ImageTransform` had `dpi: Some(72.0)` which caused printpdf to apply its own size calculation on top of the explicit `scale_x`/`scale_y` factors, resulting in incorrect image sizing and positioning. Fixed by setting `dpi: None` and computing scale purely from target mm dimensions: `scale = target_mm / (pixels * 25.4 / 72.0)`.

3. **Test mock incompatibility** — The new `fitSheetInView()` uses `new Point(...)` but the test mock used an arrow function (`vi.fn().mockImplementation(...)`) which can't be used with `new`. Fixed by converting the Point mock to a proper class in `App.test.tsx`.

Added new Rust tests: `test_a4_page_dimensions` (verifies MediaBox matches A4 595.28×841.89pt) and `test_centered_image_placement`.

### Fix 4: Viewport navigation, PDF sizing, and PDF positioning (2026-02-25)

Three issues remained after Fix 3:

1. **No scroll-to-pan** — All mouse wheel/trackpad scroll events were consumed for zooming. Users couldn't scroll to see parts of the sheet that were off-screen. Fixed by changing `zoomPan.ts` to use Ctrl+wheel (or pinch-to-zoom) for zoom and regular wheel/scroll for panning (matching Figma/Canva behavior).

2. **PDF image too small** — Fix 3 set `dpi: None` in printpdf which caused it to default to 300 DPI internally. A 500px image rendered as 120 points (500/300×72) instead of 500 points. The scale formula assumed 72 DPI base, creating a mismatch. Fixed by reverting to `dpi: Some(72.0)` which makes printpdf use 72 DPI as base, matching the scale formula: natural size = pixels = points, scale = 1.0 for unresized images.

3. **PDF image left-offset** — Page sheet had default `strokeWidth: 1`, causing the sheet's visual edge to differ from its `left` coordinate by 0.5px. This propagated as a ~2mm offset in the PDF. Fixed by setting `strokeWidth: 0` on the sheet Rect in `createPageSheet()`.

## Dependencies Added

| Dependency | Side | Purpose |
|-----------|------|---------|
| printpdf 0.7 | Rust | PDF generation |

## Files Created/Modified

### New files
- `src/canvas/sheet.ts` — PAGE_PRESETS, mmToPx/pxToMm, createPageSheet/updatePageSheet
- `src/canvas/export.ts` — collectExportData, exportPdf, PDF types
- `src-tauri/src/core/pdf.rs` — PDF generation with printpdf
- `src-tauri/src/commands/pdf.rs` — export_pdf Tauri command

### Modified files
- `src/canvas/importers.ts` — addImageToCanvas(), originalFilePath property
- `src/canvas/shortcuts.ts` — Ctrl+E export, selectAll filters sheet
- `src/canvas/index.ts` — new exports
- `src/components/Toolbar.tsx` — Image import, page-size picker, Export PDF button
- `src/components/Canvas.tsx` — drag-drop handlers, page sheet init
- `src-tauri/Cargo.toml` — printpdf dependency
- `src-tauri/src/core/mod.rs` — pdf module
- `src-tauri/src/commands/mod.rs` — pdf command module
- `src-tauri/src/lib.rs` — export_pdf in invoke_handler
