---
id: md-x10c
status: closed
deps: [md-8s9y, md-9kz2]
links: []
created: 2026-06-11T20:36:06Z
type: feature
priority: 2
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, text, fonts]
---
# Add text styling and font selection controls for calendar text

Add styling and font controls for calendar text after foundational text rendering/editing/export exists.

## Design

Support font family, font size, color, weight, alignment, and letter spacing for calendar text elements. Include at least one bundled/open handwritten script font suitable for decorative calendar headings, plus a clean sans-serif for month grids. Ensure German characters render correctly. Keep this ticket styling-only: do not add foundational text rendering, editing, persistence, or export behavior here.

## Acceptance Criteria

Users can style title/month text with a clean sans font and a handwriting/script font. Text color, size, weight, alignment, and letter spacing can be changed. German characters render correctly for the supported fonts. Existing foundational text rendering, editing, persistence, and export behavior continues to work.

## Notes

**2026-06-11T22:08:19Z**

Implemented calendar text styling controls: font family presets (clean sans/script/mono stacks), size, color, weight, alignment, letter spacing; canvas rendering and PDF export data now carry style fields; project/Rust models accept persisted style fields. Tests: pnpm test -- --run; pnpm vite build; cd src-tauri && cargo test. pnpm build compiles but existing bundling step fails because src-tauri/target/release/dsp is missing.

**2026-06-12T00:12:00Z**

Addressed review finding for the handwriting/script preset: bundled the OFL Caveat variable TTF asset (with license), registered it via `@font-face`, and made the handwriting/script presets lead with the bundled Caveat family instead of relying only on system font stacks. Calendar title defaults now use the same bundled handwriting stack. Added preset/asset regression coverage including a German umlaut/ß sample and cmap checks for German glyphs. PDF limitation remains: the export request carries requested font family/style fields, but the current Rust PDF renderer still does not embed/render arbitrary TTF fonts. Tests: pnpm exec vitest run src/__tests__/textStyles.test.ts src/__tests__/calendarContracts.test.ts src/__tests__/Canvas.test.tsx src/__tests__/Sidebar.test.tsx; pnpm exec tsc --noEmit; pnpm vite build.

**2026-06-12T00:24:00Z**

Re-review packaging check: verified `git status --short` includes the previously omitted new files/directories needed for the font fix (`src/textStyles.ts`, `src/assets/fonts/Caveat-VariableFont_wght.ttf`, and `src/assets/fonts/OFL-Caveat.txt`). Confirmed the Caveat TTF import resolves through Vite asset handling and the license is present beside the bundled font. Tests: pnpm exec vitest run src/__tests__/textStyles.test.ts; pnpm exec tsc --noEmit.

**2026-06-12T13:31:00Z**

Addressed final packaging warning: copied the Caveat OFL text into `public/licenses/OFL-Caveat.txt` so Vite includes it in `dist/licenses/OFL-Caveat.txt` alongside the emitted font asset for Tauri packaging. Added regression coverage that the public package asset matches the source license. Verified the built `dist` contains the license and matches `src/assets/fonts/OFL-Caveat.txt`. Tests: pnpm exec vitest run src/__tests__/textStyles.test.ts; pnpm exec tsc --noEmit; pnpm vite build.
