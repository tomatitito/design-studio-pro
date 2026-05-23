---
id: md-fn6t
status: open
deps: []
links: []
created: 2026-05-19T16:31:08Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [rust, pdf, backend]
---
# Extend Rust PDF export to multiple pages

Teach the backend PDF renderer to create PDFs containing all requested pages, not only one page.

## Design

Introduce a multi-page request shape, e.g. pages: Vec<PdfPageExport>, where each page has PdfPageConfig and image elements. Reuse existing single-page rendering logic for each page and add subsequent PDF pages via printpdf.

## Acceptance Criteria

Rust tests can export a PDF with 2+ pages. Backgrounds, images, coordinates, rotations, and borders still render per page. Existing single-page exports remain supported or are migrated with tests updated.

