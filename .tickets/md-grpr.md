---
id: md-grpr
status: closed
deps: [md-8s9y, md-6dqa, md-sph0]
links: []
created: 2026-06-12T11:44:11Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, months, templates]
---
# Generate all 12 calendar month pages

Create the remaining month pages so a new DIN A4 German calendar project contains one title page plus January through December for the selected year. Reuse the existing calendar page/element contracts, month page factories, and German date-generation module; do not duplicate month/date logic in UI code.

## Design

Extend calendar project/page creation to generate all 12 month pages from the fixed project year. Each month page should carry explicit calendar page role/month metadata and generated month-label/date-grid elements using the existing contracts. Start from a sensible default photo layout per page, while remaining compatible with the existing layout preset picker.

## Acceptance Criteria

New calendar projects include 13 pages: one title page followed by January through December in order. Every month page has correct German month/date content for the selected year. Month pages use the reusable date-generation/contracts/factories from md-sph0 and related slices, not duplicated date logic. Existing January behavior and photo layout preset application continue to work on all month pages.


## Notes

**2026-06-12T11:46:02Z**

Implemented calendar project generation for all 12 month pages using existing calendar month page factory/date contracts. Updated tests to cover 13-page projects, January compatibility, December presence, month metadata, German labels/date grids, and 4-photo placeholders. Verified with targeted Vitest suite and pnpm typecheck.
