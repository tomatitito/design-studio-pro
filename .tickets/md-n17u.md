---
id: md-n17u
status: closed
deps: [md-e22r, md-sph0, md-9kz2]
links: []
created: 2026-06-11T20:35:33Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, title-page, vertical-slice, text]
---
# Implement first calendar title page template

Implement the first usable calendar title page after creating a calendar project.

## Design

Use the calendar contracts/factories to create a title page with explicit page and element roles. Provide a simple DIN A4 title page template inspired by the references: background/theme area, large editable title text, optional subtitle/family-name text, and at least one photo placeholder if it fits the minimal design. Keep controls basic; the goal is an editable first page, not the full template system.

## Acceptance Criteria

A newly created calendar opens on a title page. The title page has editable text for the calendar title/year. The title page and its elements use the defined calendar page/element roles. The user can place or replace at least one image placeholder if included by the template. The title page renders on canvas and persists through save/load.

## Notes

**2026-06-11T21:49:54Z**

Implemented first calendar title page template: new calendar projects create an A4 title page with calendar roles, editable title/year and subtitle text, a theme band, and a replaceable photo placeholder. Canvas now renders title text, rectangle theme/placeholder shapes, and empty image placeholders; image imports replace calendar placeholders and persist through save/load contracts. Tests: pnpm test -- --run src/__tests__/calendarContracts.test.ts src/__tests__/App.test.tsx src/__tests__/Canvas.test.tsx src/__tests__/importers.test.ts src/__tests__/projectFiles.test.ts; pnpm exec tsc --noEmit.

**2026-06-11T23:56:00Z**

Addressed review finding: converted the title-page template's DIN A4 millimetre layout values to the app's 72 DPI display-pixel element coordinates while keeping page settings in millimetres. Added assertions for converted theme band/placeholder/text positions and export millimetre round-tripping.

**2026-06-11T23:59:00Z**

Addressed remaining review concern: empty calendar photo placeholders still render on canvas, but PDF export now skips image elements whose source path is empty/blank so the backend is never asked to read an empty imagePath. Added export coverage for skipped empty placeholders and replaced placeholders retaining their millimetre layout.
