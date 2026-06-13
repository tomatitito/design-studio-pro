---
id: md-sph0
status: closed
deps: [md-e22r]
links: []
created: 2026-06-11T20:54:34Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, project-model, templates, foundation]
---
# Define calendar page/element contracts and factories

Define explicit contracts for calendar projects, pages, and elements so calendar features integrate through stable roles/helpers instead of duplicated UI/template assumptions.

## Design

Specify calendar project metadata as projectType=calendar with calendar: { year, locale: de-DE }. Define page roles: title and month. Define element roles: photo-placeholder, title-text, subtitle-text, month-label, date-grid, and theme/decorative. Provide factory/helper functions for creating title and month pages and for identifying/replacing photo placeholders by contract role. Ensure the contracts are persisted through save/load and remain compatible with existing photo-page projects.

## Acceptance Criteria

Calendar projects persist projectType=calendar and calendar: { year, locale: de-DE }. Calendar pages persist explicit page roles for title and month pages. Calendar elements persist explicit roles for photo-placeholder, title-text, subtitle-text, month-label, date-grid, and theme/decorative. Factory/helper functions create title/month pages and identify/replace photo placeholders by role. Save/load preserves project/page/element contract data. Existing photo-page projects continue to load and behave without calendar metadata.


## Notes

**2026-06-11T21:10:12Z**

Implemented calendar contracts/factories: typed page and element roles, title/month page factories, photo placeholder detection/replacement helpers, and tests covering role persistence through save/load plus existing photo-page compatibility. Validated with pnpm typecheck, pnpm lint, and pnpm test -- src/__tests__/calendarContracts.test.ts src/__tests__/projectFiles.test.ts.

**2026-06-11T21:12:17Z**

Review: verdict changes requested. Critical finding: backend Rust Page/Element models do not include calendar page/element role fields (or page calendar month metadata), so save_project_data deserializes and drops those fields before writing manifest; actual save/load does not preserve calendar contract data despite frontend tests. Warning: pageRenderer no longer binds document IDs for non-image elements, which may break selection/persistence for rendered text/shape elements. Tests not run during review.

**2026-06-11T23:18:00Z**

Addressed review findings: Rust Page/Element models now serialize/deserialize optional calendar page roles, page calendar month metadata, and element roles; added Rust project IO round-trip coverage for calendar contract fields. Restored document element ID binding for all rendered canvas objects while keeping image source binding. Replaced timestamp-only default photo placeholder IDs with timestamp plus monotonic sequence to avoid same-millisecond collisions. Validated with cargo project_io tests, pnpm test, pnpm typecheck, and pnpm lint.
