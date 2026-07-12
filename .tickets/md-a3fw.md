---
id: md-a3fw
status: open
deps: []
links: []
created: 2026-05-25T21:18:55Z
type: task
priority: 1
assignee: Jens Kouros
tags: [architecture, balanced-coupling, technical-debt]
---
# Review and rebalance project/asset/canvas coupling

Balanced-coupling architecture review findings for Design Studio Pro.

The app is healthy for 0.1.x, but several volatile core workflows have high-strength coupling across high-distance boundaries. These should be addressed before adding many more element types, print/export features, or project-format changes.

Findings:

1. Asset paths and image element paths are unbalanced.
- Files: src-tauri/src/core/project_io.rs, src/canvas/pageRenderer.ts, src/canvas/export.ts
- Rust rewrites manifest.assets[*].file_path on load, but image elements still render/export from element.src.
- Coupling: functional/model coupling across TS/Rust + project archive boundary, high volatility.
- Risk: reopened .dsproj files can contain packed assets but image elements still point at original source paths.

2. TypeScript and Rust project/element models are duplicated.
- Files: src/types/element.ts, src-tauri/src/models/element.rs, src/projectFiles.ts
- Manual elementType <-> type conversion is a high-distance model coupling point.
- Risk increases as text, shapes, groups, constraints, print settings, and schema migrations evolve.

3. Fabric canvas and projectStore are dual sources of truth.
- Files: src/canvas/handlers.ts, src/canvas/pageRenderer.ts, src/canvas/export.ts
- Geometry, z-order, selection, borders, and export behavior are synchronized manually between Fabric and Zustand.
- This is a high-volatility editor-core coupling hotspot.

4. Canvas.tsx is an orchestration hub.
- File: src/components/Canvas.tsx
- It initializes Fabric, handles resize, default project creation, event attachment, viewport sync, content rendering, drag/drop, and IPC asset import.
- Currently cohesive, but approaching difficult-to-change size/responsibility coupling.

5. Drag/drop image import likely passes the wrong path.
- Files: src/components/Canvas.tsx, src-tauri/src/commands/assets.rs
- Drop handler passes file.name as filePath, while Rust expects a filesystem path and calls fs::metadata.
- Contract is underspecified for browser/Tauri file drop behavior.

## Design

Use the balanced-coupling model to guide refactoring:

- For volatile TS/Rust boundaries, reduce integration strength with explicit contracts/DTOs.
- Keep highly cohesive editor behavior close, but isolate Fabric-specific knowledge behind a document adapter.
- Prefer explicit project-format compatibility tests over implicit duplicated model assumptions.

Recommended implementation direction:

1. Stabilize asset references.
   - Prefer image elements referencing assetId instead of storing independent file paths, or rewrite all image element src fields on load using the loaded asset map.
   - Add save/load/export regression coverage for reopening a .dsproj after original source files are moved/deleted.

2. Introduce versioned project/IPCs DTOs.
   - Define the project serialization contract explicitly.
   - Consider generated TS types from Rust schema, shared JSON schema, or comprehensive round-trip contract tests.

3. Add a canvas document adapter layer.
   - Centralize operations such as addImageElement, moveElement, resizeElement, applyBorder, renderPage, and collectExportData.
   - Keep Fabric object internals out of components and stores where practical.

4. Split Canvas.tsx by lifecycle concern.
   - Candidate hooks: useFabricCanvasLifecycle, usePageSheetSync, useCanvasViewportSync, useCanvasDropImport, useCanvasContentRender.

5. Tighten drag/drop contract.
   - Define import_asset as accepting absolute filesystem paths only, or add a separate blob/drop import flow.
   - Use Tauri APIs/events that provide real filesystem paths for desktop drops.

## Acceptance Criteria

- Loaded .dsproj files render and export packed image assets even when original source files are unavailable.
- Project/element TS/Rust serialization has explicit contract tests or generated/shared schema coverage.
- Fabric/project synchronization logic is centralized behind a documented adapter or equivalent boundary.
- Canvas.tsx no longer owns all lifecycle/sync/drop/render responsibilities directly.
- Drag/drop import behavior is covered by tests or documented as unsupported until a correct path-based implementation exists.
- pnpm typecheck, pnpm test, and cargo test pass.

