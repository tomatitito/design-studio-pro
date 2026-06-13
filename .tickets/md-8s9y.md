---
id: md-8s9y
status: closed
deps: [md-n17u, md-93eu, md-sph0]
links: []
created: 2026-06-11T20:35:45Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, january, photo-layout, vertical-slice]
---
# Add January page with 2x2 image layout

Add the first month page: January for the selected fixed year, using a 2x2 image placeholder layout.

## Design

Generate a January page after the title page using the calendar contracts/factories. Use four editable image placeholders in a 2x2 grid. Include a minimal generated month/date element for January in German so the page is recognizably a calendar page. Prefer simple styling first.

## Acceptance Criteria

Calendar projects include a January page after the title page. January shows four image placeholders in a 2x2 layout. Placeholders can receive images and be moved/resized with existing canvas interactions. The page includes correct January date information for the selected year in German. January uses the reusable date-generation module and duplicates no month/date logic in UI or template code.

## Notes

**2026-06-11T22:01:18Z**

Implemented January calendar page after title page: four editable photo placeholders in 2x2 layout, German January month/date elements generated through calendarDates formatter, and calendar project factory/tests updated. Verified with pnpm test and pnpm typecheck.
