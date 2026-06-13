---
id: md-9kz2
status: closed
deps: [md-sph0]
links: []
created: 2026-06-11T20:54:34Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, text, foundation, export]
---
# Implement basic text rendering/editing/export foundation

Add the shared text capability calendar templates need before styling-specific work: render, edit/update, persist, and export text elements through existing project workflows.

## Design

Build on the calendar contracts so title-text, subtitle-text, month-label, and date-grid text elements use the same project/page/element model as other editable elements. Keep this ticket focused on foundational behavior, not advanced font/style controls.

## Acceptance Criteria

Text elements render on the canvas. Text content can be edited/updated through existing interactions and/or properties. Text elements persist through save/load. Text elements are included in PDF export. Existing image/photo workflows continue to work.


## Notes

**2026-06-11T21:36:09Z**

Implemented basic text foundation: Fabric Textbox rendering for text elements, content persistence via text:changed and properties textarea, save/load uses existing text element serialization, PDF export request/backend now includes text elements. Tests: pnpm test (targeted command ran suite), pnpm exec tsc --noEmit, cd src-tauri && cargo test.

**2026-06-11T21:40:59Z**

Addressed review finding: text PDF export now normalizes persisted display-pixel coordinates/sizes to millimetres, matching image export and canvas interactions for A4/mm projects instead of treating element coordinates as project-unit mm. Added single-page and multi-page moved/resized text export-data coverage. Current backend limitation documented: text width/height, rotation, and requested font family are carried in the export request but basic PDF rendering still uses unrotated built-in Helvetica without textbox layout. Tests: pnpm exec vitest run src/__tests__/pdfExportBorders.test.ts; pnpm exec tsc --noEmit; cd src-tauri && cargo test pdf.

**2026-06-11T22:08:00Z**

Addressed remaining CLI review finding: project-mode CLI PDF export now converts text element display-pixel position and size fields to millimetres using the same 72-DPI convention as the frontend. Added Rust CLI regression coverage for text px-to-mm mapping. Also updated CLI constructors/tests with default role/calendar metadata required by the current models so CLI tests build with the cli feature. Tests: cd src-tauri && cargo test --features cli.
