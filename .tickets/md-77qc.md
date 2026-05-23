---
id: md-77qc
status: open
deps: [md-04wr, md-xc9e, md-65gy, md-ghcp, md-69vl]
links: []
created: 2026-05-19T16:31:08Z
type: task
priority: 1
assignee: Jens Kouros
parent: md-po51
tags: [tests, quality, pages]
---
# Add multi-page save/load, export, and regression tests

Add targeted tests for the multi-page workflow and protect single-page behavior.

## Design

Cover project store active-page behavior, page UI interactions, canvas switching where practical, Rust multi-page PDF export, CLI project export, and .dsproj save/load preserving multiple pages.

## Acceptance Criteria

pnpm test, pnpm typecheck, pnpm lint, cargo test, and cargo test --features cli pass after the feature lands. Tests fail if multi-page projects lose pages during save/load or export only the first page.

