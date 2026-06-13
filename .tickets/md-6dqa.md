---
id: md-6dqa
status: closed
deps: [md-8s9y, md-93eu, md-sph0]
links: []
created: 2026-06-11T20:36:18Z
type: feature
priority: 2
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, photo-layout, presets]
---
# Add photo layout preset picker for calendar pages

Let users switch the photo placeholder arrangement on a calendar month page.

## Design

Start with layout presets for 1, 2, 3, and 4 photos, including the 2x2 layout from the January vertical slice and asymmetric variants inspired by the references. Applying a preset replaces/repositions photo placeholders by using the calendar placeholder roles/contracts, while keeping the month/date element and theme.

## Acceptance Criteria

A calendar page has a layout preset picker grouped by photo count. Applying a preset updates placeholders without deleting the calendar date element. The picker identifies photo placeholders via roles/contracts, not names or z-index. Applying presets preserves month/date elements and existing assigned images where practical. Resulting placeholders remain editable/movable/resizable.

## Notes

**2026-06-12T11:35:22Z**

Implemented calendar month photo layout preset picker grouped by 1/2/3/4 photo counts. Presets are applied through calendar photo-placeholder roles, preserve month/date/theme elements, carry existing assigned src/asset/style data by slot order, and keep resulting placeholders unlocked/editable. Added unit/UI coverage; ran pnpm exec tsc --noEmit and pnpm test (all 19 files/134 tests passed).

**2026-06-12T11:39:13Z**

Addressed md-6dqa review warning: applying a layout preset now places regenerated placeholders above preserved theme/decorative layers (including theme zIndex 0) while keeping month/date elements. Added regression coverage for preserved theme z-order. Ran pnpm exec vitest run src/__tests__/calendarContracts.test.ts and pnpm exec tsc --noEmit.
