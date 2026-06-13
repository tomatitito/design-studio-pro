---
id: md-53kf
status: closed
deps: [md-sph0, md-9kz2, md-x10c, md-8s9y, md-6dqa, md-mif5, md-grpr]
links: []
created: 2026-06-12T11:44:23Z
type: feature
priority: 2
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, pdf, themes, decorative, shapes]
---
# Export calendar theme and decorative elements to PDF

Ensure calendar theme, shape, background, and decorative elements that appear on title/month canvases are included in PDF export, preserving layering relative to photos and text.

## Design

Use the existing calendar element roles/contracts for theme/decorative items and existing project/page export paths. Export supported decorative primitives such as backgrounds, shapes, lines, and themed accents with their fill/stroke/opacity/z-order. Keep unsupported effects explicit rather than silently dropping important page design elements.

## Acceptance Criteria

PDF export includes calendar backgrounds/theme shapes/decorative elements for title and month pages. Layering matches the canvas closely enough that decorations can sit behind photos/text without covering them incorrectly. Unsupported decorative effects have documented fallback behavior. Tests cover export of at least one themed background/shape and one decorative element alongside calendar text/photo elements.


## Notes

**2026-06-12T12:11:45Z**

Implemented PDF export of calendar page backgrounds and decorative shape elements. Frontend payload now includes shapes and z-ordered renderable elements while preserving images/texts and skipping empty image placeholders. Rust PDF backend renders z-ordered images/texts/shapes with documented opacity fallback (flattened opaque); supports rectangle, ellipse, and line primitives, errors on unsupported decorative shape kinds. Added frontend and backend tests. Verified: pnpm exec tsc --noEmit; pnpm vitest run src/__tests__/pdfExportBorders.test.ts; cargo test --manifest-path src-tauri/Cargo.toml pdf -- --nocapture.

**2026-06-12T12:31:00Z**

Addressed review md-53kf: CLI `.dsproj` PDF export now converts project image element position/size (and border width) from display pixels to millimetres, matching text and shape conversion so photos align with backgrounds/shapes/text. Legacy text/shape/image fallback arrays now filter hidden/fully transparent elements. Backend shape rotation remains a scoped limitation: vector fallback logs a warning and exports the unrotated primitive rather than dropping the decoration. Added CLI regression coverage for image pixel-to-mm mapping and visibility filtering plus backend coverage for the rotated-shape fallback. Verified: cargo test --manifest-path src-tauri/Cargo.toml pdf -- --nocapture; cargo test --manifest-path src-tauri/Cargo.toml --features cli --bin cli -- --nocapture.

**2026-06-12T12:45:00Z**

Addressed remaining CLI coordinate consistency issue: CLI `new`/`open` still accepts `--position` and `--image-size` in millimetres, but now converts those values (including auto image sizes) into display pixels before saving image elements to `.dsproj`. Project PDF export continues to map stored display pixels back to millimetres, preventing double-conversion. Added a CLI regression that creates a project from a 144x72 image, verifies saved project geometry is display pixels, and verifies the project-PDF mapper returns the original millimetre geometry exactly once. Verified: cargo test --manifest-path src-tauri/Cargo.toml --features cli --bin cli -- --nocapture; cargo test --manifest-path src-tauri/Cargo.toml pdf -- --nocapture.

**2026-06-12T13:05:00Z**

Addressed remaining CLI border-width consistency warning: CLI `--border-width` values now follow the same millimetre semantics as `--position`/`--image-size`. Border widths are converted to display pixels before `.dsproj` storage, and project PDF export maps them back to millimetres exactly once. Updated CLI docs to state millimetre units and extended the CLI round-trip regression to cover border storage/export. Verified: cargo test --manifest-path src-tauri/Cargo.toml --features cli --bin cli -- --nocapture; cargo test --manifest-path src-tauri/Cargo.toml pdf -- --nocapture.

**2026-06-12T14:30:00Z**

Addressed remaining frontend border-width export issue: GUI/project PDF export now converts stored image border widths from display pixels to millimetres before sending the payload to the Rust PDF backend, matching positions/sizes and CLI behavior. Updated frontend PDF export tests to assert px-to-mm border widths instead of raw display pixels. Verified: pnpm vitest run src/__tests__/pdfExportBorders.test.ts; pnpm exec tsc --noEmit.
