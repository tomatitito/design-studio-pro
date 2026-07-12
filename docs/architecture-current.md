# Architecture (Current Implementation)

This document describes how the repository works today (not the target-state spec).

## 1) Runtime Topology

- Frontend: React + TypeScript + Fabric.js (`src/`)
- Backend: Tauri + Rust (`src-tauri/`)
- Bridge: Tauri IPC (`invoke`) for command calls
- Persistence format: `.dsproj` ZIP archive with `manifest.json` + packed assets/thumbnails

## 2) Frontend Structure

Primary files:

- App shell: `src/App.tsx`
- Canvas context/provider: `src/components/CanvasContext.tsx`
- Canvas component: `src/components/Canvas.tsx`
- Sidebar/toolbar/status/rulers: `src/components/*`
- Canvas utilities: `src/canvas/*`
- State stores: `src/stores/*`
- Domain types: `src/types/*`

### Frontend State

Three Zustand stores are used:

- `uiStore` (`src/stores/uiStore.ts`)
  - selected tool, selected element ids, zoom/pan, sidebar panel state
- `projectStore` (`src/stores/projectStore.ts`)
  - `currentProject`, project list, dirty state, page updates
- `historyStore` (`src/stores/historyStore.ts`)
  - generic undo/redo stack (`past/present/future`)

All three pass through `logMiddleware` (`src/stores/logMiddleware.ts`) which emits structured state-change logs to Rust (`log_zustand`) except in test mode.

### Canvas/Data Model Notes

- Fabric objects are the render/runtime layer.
- Project elements in `projectStore` are the source-of-truth model used for save/export.
- Image elements now carry optional border fields:
  - `borderStyle`
  - `borderColor`
  - `borderWidth`
- Border behavior and presets live in `src/canvas/imageBorders.ts`.

## 3) Backend Structure

Primary Rust modules:

- App bootstrap and command registration: `src-tauri/src/lib.rs`
- IPC commands: `src-tauri/src/commands/*`
- Core logic: `src-tauri/src/core/*`
  - `project_io.rs` (`.dsproj` save/load)
  - `pdf.rs` (PDF generation)
  - `thumbnails.rs` (image thumbnails)
- Models: `src-tauri/src/models/*`
- CLI binary: `src-tauri/src/bin/cli.rs` (feature-gated with `cli`)

### Registered Tauri Commands

From `src-tauri/src/lib.rs`:

- `greet`
- `log_zustand`
- Project:
  - `create_project`
  - `get_project_info`
  - `save_project`
  - `load_project`
- Canvas:
  - `add_element`
  - `update_element`
  - `remove_element`
  - `get_elements`
- Assets:
  - `import_asset`
  - `list_assets`
  - `delete_asset`
  - `generate_thumbnail`
- Filesystem:
  - `read_text_file`
  - `write_text_file`
  - `create_directory`
  - `list_directory`
- PDF:
  - `export_pdf`

### Backend In-Memory Stores

Rust-side stores managed by Tauri state:

- `ProjectStore` (`commands/project.rs`)
- `CanvasStore` (`commands/canvas.rs`)
- `AssetStore` (`commands/assets.rs`)

These are process-memory stores (Mutex-wrapped) and not durable by themselves. Durability is via explicit save to `.dsproj`.

## 4) Data Flow (Key Paths)

### A) Edit on Canvas

1. User interacts with Fabric canvas/components.
2. UI handlers update Zustand stores.
3. `projectStore` page elements are mutated for canonical app state.
4. `historyStore` can track snapshots for undo/redo behavior.

### B) Save/Load Project (`.dsproj`)

Save path:

1. Frontend invokes `save_project`.
2. Rust reads project + asset state from in-memory stores.
3. `core/project_io.rs` writes ZIP:
  - `manifest.json`
  - `assets/*`
  - `thumbnails/*`

Load path:

1. Frontend invokes `load_project` with archive and extraction dir.
2. Rust extracts archive contents.
3. Asset paths are rewritten to extracted file locations.
4. Loaded project/assets are inserted into Rust stores and returned.

### C) Export PDF

1. Frontend collects page/image geometry from Fabric + project model (`src/canvas/export.ts`).
2. Frontend invokes `export_pdf` command with `PdfExportRequest`.
3. Rust `core/pdf.rs` renders page background and images, then writes PDF.
4. Image border fields are resolved and drawn as outlines during export.

### D) CLI Pipeline

CLI (`dsp`) supports:

- `new`: create `.dsproj`
- `open`: modify existing `.dsproj` (add images, background, borders)
- `export-pdf`: export from project or ad-hoc image inputs

CLI and GUI share Rust models/core code paths, which keeps file format and PDF behavior aligned.

## 5) Testing Layout

- Frontend tests: `src/__tests__` (Vitest)
- Rust tests: inline `#[cfg(test)]` modules under `src-tauri/src/**`
- Notable recent tests:
  - `src/__tests__/imageBorders.test.ts`
  - `src/__tests__/pdfExportBorders.test.ts`

## 6) Known Boundaries and Tradeoffs

- Some spec docs in `specs/` are aspirational; this file reflects current code.
- Rust command stores are in-memory and simple by design.
- Frontend uses direct state updates for many workflows; not every edit path goes through backend commands immediately.

## 7) Planned Double-Page Spread Architecture

Double-page spread support uses explicit ordered units instead of inferring pairs from page parity. See user-facing behavior in [double-page-spreads.md](double-page-spreads.md).

### Persistence invariants

- Project order is represented as explicit units: single pages and spreads.
- Legacy projects with only `pages` migrate by preserving page order and treating every page as a single-page unit.
- Each spread stores left/right physical page identity and metadata plus one shared element scene.
- Physical pages remain available for pagination, sidebar labeling, save/load, and PDF export.
- Existing pages are not converted into spreads; insertion creates a new spread unit.

### Pagination and validation invariants

- First project page is physical right.
- Following physical page is editable blank left.
- First photo/content page starts on physical right.
- Every spread starts on physical left and consumes exactly two equal-sized physical pages.
- Side calculation, normalization, insertion, deletion, movement, and reorder validation belong in domain helpers.
- UI components must call domain helpers instead of independently implementing pagination rules.
- Misaligned spread insertion offers exactly `Insert editable blank page` and `Cancel`.
- Deleting a single page that would invalidate a later spread offers exactly `Insert blank replacement` and `Cancel deletion`.

### Coordinate invariants

- Single pages use page-relative coordinates.
- Spreads use spread-relative coordinates with width `2 * page.width` and height `page.height`.
- Left page covers `x = 0..page.width`.
- Right page covers `x = page.width..2 * page.width`.
- Boundary width is zero; gutter/divider is visual only.
- Elements, guides, and selections may cross the boundary.
- A spread owns one shared element scene; cross-boundary elements are not duplicated while editing.

### PDF clipping invariants

- Export emits two physical PDF pages for each spread.
- Left output page clips spread scene to `x = 0..page.width`.
- Right output page clips spread scene to `x = page.width..2 * page.width`.
- Right-page rendering translates content by `-page.width`.
- Cross-boundary elements appear on both outputs through clipping.
- Initial export clips exactly at the zero-width boundary; print bleed is future work.

## 8) Where To Extend

- New canvas behavior:
  - Add/update logic in `src/canvas/*`
  - Wire controls in `src/components/*`
  - Persist new fields in `src/types/*` and Rust `src-tauri/src/models/*`
- New project persistence behavior:
  - `src-tauri/src/core/project_io.rs`
- New export behavior:
  - Frontend payload in `src/canvas/export.ts`
  - Backend rendering in `src-tauri/src/core/pdf.rs`
- New CLI options:
  - `src-tauri/src/bin/cli.rs`
  - Document in `docs/cli.md`
