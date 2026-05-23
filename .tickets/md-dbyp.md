---
id: md-dbyp
status: closed
deps: []
links: []
created: 2026-05-19T16:31:08Z
type: task
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [frontend, state, pages]
---
# Add active page state and project page selectors

Introduce an active page concept so app code no longer assumes currentProject.pages[0]. Add helper selectors/utilities for retrieving the active page and a safe fallback when projects load.

## Design

Add activePageId to an appropriate Zustand store, set it when projects are created/loaded, and ensure it remains valid after page add/remove. Replace first-page lookups incrementally with active-page helpers.

## Acceptance Criteria

There is a single active page id in state. Loading or creating a project selects a valid page. Removing the active page selects another valid page or handles empty projects safely. TypeScript tests cover the selection behavior.

