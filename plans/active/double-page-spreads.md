# Double-page spreads

## Goal

Support mixed single pages and double-page spreads. A spread is edited as one continuous surface, always starts on a physical left side, permits elements/guides/selections across zero-width page boundary, and exports as two physical pages.

## Product rules

- First project page is physical right (title page).
- Following physical left page is editable blank (back of title page).
- Photo content begins on following right page.
- Ordered content may mix single pages and spreads.
- Spread owns equal-sized left/right pages and one shared element scene.
- Spread insertion occurs after selected page/spread only when resulting start side is left.
- If alignment is wrong, offer exactly `Insert editable blank page` and `Cancel`.
- Spread moves and deletes atomically; existing pages cannot be converted into a spread.
- Deleting a single page that would invalidate later spread offers exactly `Insert blank replacement` and `Cancel deletion`.
- Gutter is visual; boundary width is zero.
- Elements, guides, and selections may cross boundary.
- PDF export clips shared spread scene into separate left and right physical pages.
- Initial export clips exactly at boundary; print bleed remains future work.

## Architecture

Use explicit ordered units rather than inferring pairs from page parity.

- `Project.units`: ordered references to single pages or spreads, or equivalent explicit unit metadata compatible with existing `pages` persistence.
- `Spread`: id, left/right page identity and metadata, shared elements in spread-relative coordinates.
- Keep physical pages available to export and pagination logic.
- Add migration from existing `Project.pages`: preserve order and treat each as single unit.
- Centralize side calculation, normalization, insertion, deletion, and reorder validation in domain helpers. UI must not implement pagination independently.
- Canvas resolves active editing unit. Single unit uses page coordinates; spread uses combined `2 * width` coordinates and two backgrounds separated by visual divider.

## Tickets

### 1. Domain model and pagination

- Add TS types for project units, spreads, editable blanks, and physical sides.
- Add pure helpers for ordered units, consumed physical pages, side at insertion point, and invariant validation.
- Add operations for spread insertion, unit movement, spread deletion, and guarded single deletion.
- Migrate legacy projects without unit metadata.
- Unit tests for title/right, blank/left, first-photo/right sequence and all mutation outcomes.

Likely files: `src/types/page.ts`, `src/types/project.ts`, `src/types/index.ts`, new `src/spreads.ts`, `src/stores/projectStore.ts`, `src/projectTemplates.ts`, `src/projectCoordinates.ts`.

### 2. Persistence and Rust model

- Mirror model in Rust with serde-compatible defaults.
- Preserve legacy `.dsproj` loading and new-model round trips.
- Update frontend/backend conversion where required.
- Add Rust and frontend persistence tests.

Likely files: `src/projectFiles.ts`, `src-tauri/src/models/page.rs`, `src-tauri/src/models/project.rs`, `src-tauri/src/core/project_io.rs`.

### 3. Canvas spread editing

- Render active single or spread unit.
- Spread viewport has two page backgrounds and zero-width divider.
- Render shared elements from spread-relative coordinates.
- Fit/pan/clamp against combined spread bounds.
- Keep cross-boundary selection and guides functional.
- Route object updates, text, image insertion, and drops to active unit.
- Ensure page-sheet movement and coordinate persistence do not corrupt content.

Likely files: `src/components/Canvas.tsx`, `src/canvas/sheet.ts`, `src/canvas/pageRenderer.ts`, `src/canvas/handlers.ts`, `src/canvas/importers.ts`, `src/canvas/textTool.ts` and canvas tests.

### 4. Sidebar and guarded workflows

- Add `Add double page` after selected unit.
- Group left/right spread thumbnails and select spread as one editing unit.
- Move/delete spread atomically.
- Implement alignment and deletion prompts with exact choices from product rules.
- Identify editable blank, left, right, and spread pages visually.

Likely files: `src/components/Sidebar.tsx`, dialog components, sidebar/store tests.

### 5. Export

- Convert each spread into two physical export pages.
- Clip shared elements at x=`page.width`; translate right-page content by `-page.width`.
- Crossing elements appear on both outputs through clipping.
- Preserve physical order and dimensions.
- Add frontend export-data and Rust PDF regression tests.

Likely files: `src/canvas/export.ts`, `src-tauri/src/core/pdf.rs`, export tests.

### 6. Documentation

- Add user guide covering pagination, creation, blank insertion, editing across boundary, moving/deleting, prompts, and two-page PDF output.
- Add sequence diagram: title right → editable blank left → first photo right → earliest spread left/right.
- Add contextual help/tooltips and troubleshooting.
- Update architecture docs with persistence, coordinate, validation, and clipping invariants.
- Add release-note/README feature entry where appropriate.

Likely files: new `docs/double-page-spreads.md`, `docs/architecture-current.md`, `README.md`, UI help copy.

## Validation

- `pnpm test`
- `pnpm lint`
- `pnpm build`
- Rust tests for model/project I/O/PDF
- Manual: create mixed project, insert/move/delete singles and spreads, accept/cancel every prompt, place image across boundary, save/reopen, export PDF and inspect both clipped pages.

## Parallelization

1. Domain/store/model first; APIs unblock remaining work.
2. Rust persistence can run parallel once model contract is fixed.
3. Canvas and Sidebar should be separate workers after domain merge; avoid overlapping store/type edits.
4. Export follows shared scene model; documentation can run in parallel from this specification.
