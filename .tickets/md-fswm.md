---
id: md-fswm
status: in_progress
deps: []
links: []
created: 2026-06-13T08:13:37Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [calendar, canvas, pdf, groups]
---
# Render calendar data as grouped component

Calendar month pages currently render the month label and date grid as two separate top-level elements. This makes the calendar data area behave like two independent objects and prevents treating it as one component. Implement proper GroupElement support and use it so each month page has a single calendar data component containing the month label and date grid as children.

## Design

Preferred model:
- GroupElement position is page-relative.
- Child element positions are group-relative.
- Calendar data group id: calendar-month-${month}-data (or equivalent).
- Calendar data group role: calendar-data.
- Children retain roles month-label and date-grid so separate styling/theming remains possible.

Implementation areas:
1. Render GroupElement in src/canvas/pageRenderer.ts, likely using Fabric groups.
2. Persist movement/resize/rotation of selected groups in canvas handlers.
3. Export groups in src/canvas/export.ts by recursively flattening child elements with parent transforms/offsets.
4. Add shared recursive element helpers for find/update/map/flatten as needed.
5. Update calendar generation in src/calendarContracts.ts to create one grouped calendar data element instead of two top-level text elements.
6. Update theme/layout code to traverse grouped children.
7. Update Sidebar selection behavior for groups; child text editing can be explicit follow-up if not included.
8. Update image border and coordinate normalization helpers if they assume only top-level elements.
9. Update TS and Rust tests that expect month-label/date-grid as top-level elements.

## Acceptance Criteria

- Month pages contain one top-level calendar data GroupElement rather than separate top-level month-label and date-grid elements.
- The grouped calendar data component is visible on canvas.
- Selecting/moving the calendar data component moves month label and date grid together and persists the updated group position.
- Month label and date grid can retain distinct text styles.
- PDF export includes grouped month label and date grid at correct positions.
- Existing calendar theme/layout behavior still applies to grouped calendar data.
- Tests cover grouped rendering, export, and calendar template structure.


## Notes

**2026-06-13T08:30:56Z**

Agent implementation completed and reviewer ran a Balanced Coupling review. Summary: grouped calendar-data implementation is mostly on track and tests/typecheck reportedly pass. Review concerns: PDF export does not fully apply group rotation/scaling transforms to child coordinates/sizes; group resize persistence may not remain WYSIWYG because child geometry/scale is not persisted; group semantics are duplicated across renderer/handlers/export/helpers and should be centralized in follow-up. Acceptance criteria mostly satisfied except full transform fidelity for rotate/resize.
