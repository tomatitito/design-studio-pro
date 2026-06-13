---
id: md-venx
status: closed
deps: [md-9kz2, md-x10c, md-sph0]
links: []
created: 2026-06-12T12:35:13Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, text, workflow, editor]
---
# Add workflow for placing new text boxes

Add an explicit add-text workflow/text tool behavior so users can place new editable text boxes on calendar pages, and keep the behavior compatible with existing photo pages where the shared page model supports text elements. This closes the remaining whole-epic blocker: existing text work supports template text rendering/editing/styling/export, but users still need a way to create additional text boxes themselves.

## Design

Build on the existing text element foundation and styling contracts from md-9kz2 and md-x10c. Reuse calendar/page/element role contracts from md-sph0 where calendar-specific metadata is needed, but keep newly user-added text generic unless a specific calendar role is intentionally assigned. Scope should cover the editor interaction (toolbar/tool or equivalent command), click/drag placement on the active page, sensible default text/style values, selection/properties integration, persistence, undo/redo if supported by the existing edit path, and PDF/export compatibility through the already established text pipeline. Avoid creating a parallel text model or calendar-only implementation.

## Acceptance Criteria

Users can choose an add-text/text-box tool or equivalent workflow and place a new text box on the active calendar page. The created text box is immediately selectable/editable and uses the existing text styling controls. New text boxes persist through save/load and are included in PDF/export output via the existing text foundation. The workflow does not regress editing of template calendar text or photo placeholders. Existing photo-page projects can add text boxes as well if the current shared page/canvas contracts support text elements there without special-casing.


## Notes

**2026-06-12T12:39:44Z**

Implemented add-text workflow: text tool click creates a default editable text box on the active page, drag sizes a new text box, selects/opens properties, persists via shared page text model, and uses existing render/edit/export paths. Added Canvas coverage for click and drag placement. Tests: pnpm vitest run src/__tests__/Canvas.test.tsx; pnpm typecheck; pnpm test.

**2026-06-12T14:44:00Z**

Addressed review critical: text placement now clamps/sizes against the rendered sheet dimensions in display pixels instead of the page model width/height, which may be millimetres. Added Canvas coverage for click and drag placement near the rendered A4 right/bottom edges. Tests: pnpm vitest run src/__tests__/Canvas.test.tsx; pnpm typecheck; pnpm lint.
