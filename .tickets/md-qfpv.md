---
id: md-qfpv
status: closed
deps: []
links: []
created: 2026-06-11T20:35:13Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, onboarding, vertical-slice]
---
# Add project type choice for photo page vs calendar

Add an entry-point choice that lets the user start either the existing photo-page/photo-sheet workflow or a new calendar workflow.

## Design

Keep this thin: expose a project type selection in the existing new-project/start flow and persist the selected project type in the project model. Calendar can initially route to a minimal scaffold; do not implement the full calendar editor in this ticket.

## Acceptance Criteria

New project creation offers Photo Page and Calendar choices. Choosing Photo Page preserves current behavior. Choosing Calendar creates/opens a calendar project shell. Project type survives save/load where applicable. Legacy projects without `projectType` load as the existing Photo Page workflow.

## Notes

**2026-06-11T20:59:30Z**

Implemented project type selection for Photo Page vs Calendar. Added projectType persistence/defaulting across frontend/backend save-load, new toolbar choices, and minimal calendar project shell. Tests: pnpm test -- --run src/__tests__/App.test.tsx src/__tests__/projectFiles.test.ts (ran full Vitest suite); pnpm typecheck; cd src-tauri && cargo test.

**2026-06-11T21:01:27Z**

Review: implementation inspected against acceptance criteria. No correctness issues found. Verified diff paths for New Photo Page/Calendar choices, calendar shell creation, projectType save/load/defaulting, and legacy fallback. Tests not re-run during review; prior implementation note reports Vitest/typecheck/cargo test.

**2026-06-11T21:01:43Z**

Review update: focused frontend test command run after review: pnpm test -- --run src/__tests__/App.test.tsx src/__tests__/projectFiles.test.ts src/__tests__/importers.test.ts. Vitest interpreted this as the full suite; 15 files / 107 tests passed. git diff --check passed.

**2026-06-12T18:17:01Z**

UX follow-up: replaced prompt-based New Calendar year entry with in-app dialog, strict four-digit validation, automatic January selection, Properties panel focus, and visible layout guidance/tests.
