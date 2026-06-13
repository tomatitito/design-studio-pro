---
id: md-04gj
status: closed
deps: []
links: []
created: 2026-06-11T20:34:54Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [calendar, epic]
---
# Epic: DIN A4 German image calendar design

Add a vertical-slice workflow for designing DIN A4 image calendars in Design Studio Pro. Initial scope: German locale, fixed project year, one title page plus one page per month. Build incrementally: first choose photo page vs calendar, then title page, then January with a 2x2 image layout, then additional layouts, themes/colors, and months.

## Design

Optimize for early usable vertical slices rather than a broad platform rewrite. Calendar support should reuse existing page/canvas/project/export infrastructure where possible. Calendar pages are regular editable pages with extra generated/template elements: photo placeholders, title/month text, calendar date elements, background/theme tokens, and optional locked decorative assets.

## Acceptance Criteria

Epic is complete when a user can create a DIN A4 German image calendar project for a fixed year, edit a title page and all 12 month pages, choose multiple photo layouts and color themes, add photos/text, and export the calendar to PDF.


## Notes

**2026-06-11T20:55:45Z**

Balanced Coupling ticket refactor: recommended implementation order is md-qfpv -> md-e22r -> md-sph0 -> md-93eu -> md-9kz2 -> md-n17u -> md-8s9y -> md-x10c/md-6dqa. Contracts and pure date generation now precede UI/template slices to avoid duplicated functional coupling across calendar pages.

**2026-06-12T11:44:47Z**

Final whole-epic review follow-up: the original vertical slices closed the contracts, title page, January page, text foundation/styling, and layout preset picker, but the epic acceptance criteria still require a complete 13-page calendar, theme/color choices, and faithful PDF output. Added focused child tickets for generating all 12 month pages, improving PDF fidelity for calendar text/date grids, exporting theme/shape/decorative elements, and adding basic theme/color selection. These keep the remaining work scoped around existing contracts and closed slices instead of reopening implementation tickets.

**2026-06-12T12:35:17Z**

Whole-epic review blocker documented: calendar acceptance requires users to add photos/text, but closed text tickets currently provide rendering/editing/styling/export for existing/template text rather than an explicit workflow to create additional user text boxes. Added final child ticket md-venx to implement an add-text/text-box placement workflow on calendar pages, reusing md-9kz2 text foundation, md-x10c styling controls, and calendar contracts as needed; photo pages should be supported where the shared page model allows it.

**2026-06-12T12:50:51Z**

Final validation passed. All direct child tickets are closed. Acceptance covered by closed slices: calendar project type and DIN A4 German shell; title page plus all 12 month pages; German date generation; multiple photo layouts; basic theme/color selection; photo/text editing workflows; text styling/font controls; and PDF export fidelity for calendar text/date grids, theme, shapes, and decorative elements. Validation run: pnpm test (19 files/143 tests passed), pnpm typecheck (passed), pnpm lint (passed), pnpm exec vite build (passed), cargo test --manifest-path src-tauri/Cargo.toml (209 passed), cargo test --manifest-path src-tauri/Cargo.toml --features cli (209 lib + 13 cli + 13 dsp passed), cargo build --manifest-path src-tauri/Cargo.toml --release --features cli (passed), pnpm build / tauri build (passed after building release CLI sidecar).
