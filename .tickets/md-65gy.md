---
id: md-65gy
status: open
deps: [md-dbyp]
links: []
created: 2026-05-19T16:31:08Z
type: task
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, canvas, state]
---
# Persist edits to the active page

Update editing paths that currently write to pages[0] so they target the active page.

## Design

Audit importers, sidebar background/border controls, history snapshots, object modification handlers, and export data collection. Replace first-page assumptions with active-page access.

## Acceptance Criteria

Image import/drop adds images to the active page only. Background presets affect the active page only. Border controls affect images on the active page only. Undo/redo snapshots restore the page they were captured from.

