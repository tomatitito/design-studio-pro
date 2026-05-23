---
id: md-ghcp
status: open
deps: [md-fn6t, md-65gy]
links: []
created: 2026-05-19T16:31:08Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, pdf, export]
---
# Export all project pages from the GUI

Update GUI PDF export to export every page in project order.

## Design

Build the PDF request from currentProject.pages rather than only from currently visible Fabric objects. Resolve image paths and element geometry from the project model. Preserve existing border/background behavior.

## Acceptance Criteria

A project with multiple pages exports one PDF containing every page in order. Export still works for one-page projects. Tests cover request construction for two pages.

