---
id: md-mif5
status: closed
deps: [md-sph0, md-x10c, md-8s9y, md-6dqa]
links: []
created: 2026-06-12T11:44:28Z
type: feature
priority: 2
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, themes, colors, ui]
---
# Add basic calendar theme and color selection

Add a basic user-facing theme/color selection workflow for calendar title and month pages so users can choose a coherent visual theme across the calendar.

## Design

Provide a small set of theme/color presets that apply through calendar theme/decorative contracts rather than hard-coded page assumptions. The selected theme should update relevant title/month text colors, backgrounds, and decorative elements where applicable while preserving photo placeholders and date-grid content.

## Acceptance Criteria

Users can choose from basic calendar theme/color presets. Applying a theme affects both title and month pages consistently. Theme changes preserve page roles, month/date-grid elements, photo placeholders, and assigned images. Theme/color selections persist through save/load and are represented by calendar contracts suitable for PDF export.


## Notes

**2026-06-12T12:01:15Z**

Implemented basic calendar theme/color presets in calendar contracts and Sidebar UI. Theme application updates project calendar.themeId plus title/month page backgrounds, title/subtitle/month/date text colors, and theme/decorative shape color tokens while preserving photo placeholders/date elements/assigned images. Added save/load persistence via calendar metadata defaults and tests.

**2026-06-12T12:04:04Z**

Review md-mif5 critical: backend Rust CalendarSettings now serializes/deserializes optional calendar.themeId and .dsproj save/load round-trip preserves the selected calendar theme ID. Added backend assertions for themeId JSON and archive round-trip.
