---
id: md-69vl
status: open
deps: [md-fn6t]
links: []
created: 2026-05-19T16:31:08Z
type: feature
priority: 2
assignee: Jens Kouros
parent: md-po51
tags: [cli, pdf, export]
---
# Export all project pages from the dsp CLI

Update dsp export-pdf project mode so .dsproj exports include all pages.

## Design

Loop over project.pages in order, build per-page PdfPageExport values, resolve extracted asset paths as today, and call the multi-page PDF backend.

## Acceptance Criteria

dsp export-pdf project.dsproj -o book.pdf exports all project pages. CLI ad-hoc export remains single-page unless separately extended. CLI tests cover multi-page project export request construction or output.

