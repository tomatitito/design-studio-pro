---
id: md-y4e8
status: open
deps: []
links: []
created: 2026-05-26T05:23:32Z
type: bug
priority: 0
assignee: Jens Kouros
parent: md-a3fw
tags: [persistence, assets, export, balanced-coupling]
---
# Fix image asset paths when loading .dsproj files

Fix the high-risk save/load coupling issue identified in the balanced-coupling review.

When loading a .dsproj archive, Rust rewrites manifest.assets[*].file_path to point at extracted files, but page image elements still store/render/export from element.src. This can leave reopened projects pointing at the original source image paths instead of the packed/extracted assets.

Affected areas:
- src-tauri/src/core/project_io.rs
- src/canvas/pageRenderer.ts
- src/canvas/export.ts
- src/projectFiles.ts, if frontend/backend conversion needs adjustment

Risk:
A .dsproj may save assets correctly, but after reopening it can fail to render/export images if the original source files moved or were deleted.

## Design

Preferred short-term fix:

1. During project_io::load_project, keep a mapping from each asset's original file_path to its rewritten extracted file_path.
2. After asset path rewriting, walk loaded project pages/elements recursively.
3. For every image element, if src matches an original asset path, rewrite src to the extracted asset path.
4. Preserve existing project format compatibility.

Also consider whether matching by filename or asset id is needed for legacy cases, but avoid ambiguous filename-only rewrites unless tests cover collision behavior.

Longer-term direction, outside this ticket:
Move image elements toward assetId references so file paths are not duplicated between assets and elements.

## Acceptance Criteria

- Loading a .dsproj rewrites image element src fields to extracted asset paths when they reference archived assets.
- Recursive/grouped image elements are handled if supported by the model.
- A Rust regression test proves that a saved project with an image loads with element.src pointing at the extracted asset path.
- If practical, add/adjust frontend tests to verify openProjectFromDialog returns image elements with usable extracted paths.
- Existing save/load behavior remains backward compatible.
- pnpm typecheck, pnpm test, and cd src-tauri && cargo test pass.

