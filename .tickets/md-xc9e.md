---
id: md-xc9e
status: closed
deps: [md-dbyp]
links: []
created: 2026-05-19T16:31:08Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, canvas, pages]
---
# Render and switch active pages on the Fabric canvas

Make the canvas display the selected active page instead of permanently displaying page 1.

## Design

When activePageId changes, update the sheet background and replace page element Fabric objects with objects reconstructed from the active page model. Keep helper objects like the page sheet separate from page content.

## Acceptance Criteria

Switching from Page 1 to Page 2 shows Page 2 content/background. Switching back restores Page 1 content/background. Page content does not leak between pages. Existing zoom/pan behavior remains usable.

