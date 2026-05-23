---
id: md-k9r2
status: open
deps: [md-65gy, md-ghcp]
links: []
created: 2026-05-23T22:10:05Z
type: bug
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, canvas, pdf, export, pages]
---
# Fix page-relative image coordinates for save/load and PDF export

Images in multi-page projects can be saved/exported with absolute Fabric canvas coordinates that include the UI page-sheet offset. PDF export then interprets those values as page-relative coordinates, so images appear too far to the right/down in exported PDFs.

Observed example: `~/Pictures/doublepage.dsproj` stores A4 image positions around `x=280`, while a centered ~298 px wide image should be around `x=148.5` on a ~595 px wide page. The exported `~/Pictures/doublepage.pdf` contains matching PDF image transforms around `x=280 pt`, confirming export is using the saved absolute position.

## Design

Use one coordinate convention consistently:

- Project model element positions are page-relative, with `(0, 0)` at the page's top-left.
- Fabric display positions are derived by adding the current page sheet origin.
- Import/drop/move/resize persist page-relative positions only.
- PDF export uses page-relative model positions directly.
- Save/load should preserve page-relative positions.
- Add normalization/migration for existing `.dsproj` projects that already contain absolute canvas positions, when safely detectable.
- Default image import should place images centered on the page unless an explicit drop position is provided.

## Acceptance Criteria

A centered image remains centered after page switch, save, reload, and PDF export. Multi-page PDF export places images identically to the canvas preview on every page. Existing affected projects such as `doublepage.dsproj` can be corrected or normalized without manually editing JSON. Regression tests cover import, render, save/load coordinate persistence, and export request construction.
