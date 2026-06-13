---
id: md-e22r
status: closed
deps: [md-qfpv]
links: []
created: 2026-06-11T20:35:25Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, project-model, vertical-slice]
---
# Create minimal DIN A4 German calendar project shell

After choosing Calendar, create a DIN A4 portrait calendar project with German locale and a fixed year setting.

## Design

Use DIN A4 portrait page dimensions. Add calendar metadata to the project model as `projectType=calendar` plus a grouped `calendar: { year, locale }` object where locale is `de-DE`. Initially create only the title page so the next vertical slice can focus on it.

## Acceptance Criteria

Calendar projects are DIN A4 portrait by default. User can set or confirm the calendar year. Calendar metadata is grouped explicitly as `calendar: { year, locale }` with locale `de-DE` and `projectType=calendar`. The initial page list contains a title page. Non-calendar projects remain save/load compatible.

## Notes

**2026-06-11T21:05:40Z**

Implemented minimal DIN A4 portrait German calendar shell: toolbar prompts/confirms year, project metadata includes projectType=calendar and calendar { year, locale: de-DE }, initial title page only, and non-calendar save/load remains compatible. Tests: pnpm typecheck; pnpm test -- src/__tests__/App.test.tsx src/__tests__/projectFiles.test.ts; cd src-tauri && cargo test project:: --lib; cd src-tauri && cargo test project_io --lib.

**2026-06-11T21:07:04Z**

Review: verified DIN A4 portrait calendar shell, year prompt, projectType=calendar, calendar { year, locale: de-DE }, title-page-only initialization, and non-calendar save/load defaults in diff. No code changes made. Tests not rerun during review due read-only/build restrictions; implementation note lists prior test runs. Finding: consider stricter year prompt parsing to reject partial values such as '2031abc'.
