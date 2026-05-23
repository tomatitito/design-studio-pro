---
id: md-04wr
status: closed
deps: [md-dbyp]
links: []
created: 2026-05-19T16:31:08Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, ui, pages]
---
# Build basic Pages panel UI

Implement the existing sidebar Pages tab as a minimal page manager.

## Design

Show project pages in order with active-page highlighting. Provide Add Page, Select Page, and Delete Page actions. New pages should use the current project page settings and a default white background.

## Acceptance Criteria

Users can add at least two pages, switch between them, and delete non-final pages from the sidebar. The active page is visually indicated. Dirty state is set on page mutations.

