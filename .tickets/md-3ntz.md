---
id: md-3ntz
status: closed
deps: [md-9kz2, md-x10c, md-8s9y, md-sph0]
links: []
created: 2026-06-12T11:44:17Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, pdf, text, date-grid]
---
# Improve PDF fidelity for calendar text and date grids

Make PDF export faithfully render calendar text and generated date grids, including multiline textbox layout and style/font handling. If full font embedding/layout is too large for one slice, explicitly stage the scope and document any remaining limitation before closing.

## Design

Build on the basic text export foundation and style controls. PDF output should honor textbox dimensions, line wrapping/multiline layout, alignment, color, font size, font weight, letter spacing where feasible, and supported font family behavior for title/month/date-grid elements. Prefer shared frontend/export measurement contracts or robust backend layout rather than ad hoc per-element positioning.

## Acceptance Criteria

Exported PDFs preserve readable title, subtitle, month label, and date-grid text with correct positions and multiline wrapping within their boxes. Calendar text styles are either faithfully applied, including supported fonts, or the ticket records an explicit staged scope with tests and visible fallback behavior. German characters render correctly in exported PDFs. Regression coverage exercises title text and a month date grid in PDF export data/backend rendering.


## Notes

**2026-06-12T11:51:30Z**

Implemented PDF text fidelity slice: backend textbox-aware multiline wrapping, line height/height clipping, left/center/right alignment, color/font size/letter-spacing rendering, rotation, built-in font fallback mapping for sans/serif/mono with bold weights, and bundled Caveat embedding for script/handwriting text so German umlauts/ß render. Preserved existing image export path. Known staged limitation: typography metrics are approximate for wrapping/alignment rather than browser/Fabric-exact shaping/kerning; full theme/shape export and theme picker intentionally not in scope. Tests: pnpm vitest run src/__tests__/pdfExportBorders.test.ts src/__tests__/calendarContracts.test.ts src/__tests__/calendarDates.test.ts src/__tests__/textStyles.test.ts; cd src-tauri && cargo test --lib.

**2026-06-12T11:52:57Z**

Review: tests pass, but PDF date-grid whitespace is collapsed by backend wrapping (split_whitespace), so monospaced calendar rows with padded spacing will not preserve alignment. Also letterSpacing is exported as Fabric em units but rendered in PDF as raw pt/mm-scaled spacing, causing mismatch; rotated multiline text is approximate because each line is independently transformed. No code changes made during review.

**2026-06-12T12:00:00Z**

Addressed review findings for backend PDF text only: wrapping now preserves input whitespace runs instead of using split_whitespace, with regression tests for leading/repeated spaces in monospaced date-grid rows and wrapping output. Letter spacing now follows the frontend Fabric convention where stored letterSpacing is an em value (`charSpacing = letterSpacing * 1000`), so PDF measurement/emission scales spacing by font size. Documented current staged limitations in code: justify falls back to left alignment, and rotated multiline text remains line-by-line baseline rotation rather than browser/Fabric-exact block shaping. Tests: `cd src-tauri && cargo test --lib core::pdf::tests -- --nocapture`; `cd src-tauri && cargo test --lib`.
