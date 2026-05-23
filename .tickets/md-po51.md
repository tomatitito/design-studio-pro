---
id: md-po51
status: open
deps: []
links: []
created: 2026-05-19T16:30:44Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [pages, pdf, book]
---
# Epic: Multi-page projects and book PDF export

Enable Design Studio Pro projects to contain multiple editable pages and export/save them as a multi-page book PDF. This epic establishes active-page editing in the canvas, page management UI, project persistence expectations, and GUI/CLI multi-page export.

## Design

Use the existing Project.pages data model as the source of truth. Add active page selection in frontend state. Render only the active page in Fabric, but save/export all pages from the project model. Extend Rust PDF export from a single page request to a multi-page request while preserving backward-compatible behavior where practical.

## Acceptance Criteria

Users can create, select, edit, save, reload, and export projects with 2+ pages. GUI PDF export includes every page in project order. CLI project PDF export includes every page. Existing single-page workflows continue to work.

