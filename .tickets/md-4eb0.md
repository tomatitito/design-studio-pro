---
id: md-4eb0
status: open
deps: []
links: []
created: 2026-07-12T00:00:00Z
type: feature
priority: 1
assignee: Jens Kouros
tags: [cli, spreads, export, pagination]
---
# Add double-page spread support to CLI

Expose double-page spread creation, editing, and export through `dsp` while enforcing same pagination rules as desktop UI.

Current CLI preserves spread fields during project load/save but cannot create or target spreads. Project PDF export reads only `project.pages`, so spread scenes are omitted.

## Design

- Add `dsp open` options for inserting a spread after an explicitly selected page/unit.
- Require resulting spread start to occupy physical left side.
- Provide non-interactive, script-safe handling when alignment needs editable blank page, such as explicit `--insert-alignment-blank`; without opt-in, fail with actionable error.
- Preserve opening sequence: title right, editable blank left, first photo right.
- Create equal-sized left/right physical pages and shared spread-relative element scene.
- Allow images to target spread scene with positions spanning zero-width boundary.
- Add unit/spread selectors stable enough for scripts; document id/index semantics.
- Make `dsp export-pdf project.dsproj` expand spread units into two ordered physical pages, translate right-side coordinates, and clip each output exactly at page boundary.
- Reuse or mirror one pagination/export domain contract; avoid independent GUI/CLI rules drifting.
- Update `docs/cli.md` with commands, examples, alignment failures, cross-boundary placement, and PDF behavior.

## Acceptance Criteria

- CLI can insert double-page spread after selected page/unit.
- Invalid left-side alignment fails unless caller explicitly requests editable alignment blank.
- Reserved title/blank/photo opening cannot be invalidated.
- CLI can add at least image elements to shared spread scene, including element crossing boundary.
- CLI project export includes spreads as two physical pages in correct order.
- Left/right export clips exactly at boundary; crossing element appears in both outputs.
- CLI load/save preserves pages, units, spreads, shared elements, and packed image assets.
- Existing single-page commands remain backward compatible.
- CLI reference documents complete workflow.
- Rust tests cover insertion alignment, blank opt-in, shared element placement, persistence, and export.
- `cargo test --manifest-path src-tauri/Cargo.toml --features cli`, frontend tests, typecheck, and lint pass.
