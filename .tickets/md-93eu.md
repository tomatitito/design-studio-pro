---
id: md-93eu
status: closed
deps: [md-e22r]
links: []
created: 2026-06-11T20:35:57Z
type: feature
priority: 1
assignee: Jens Kouros
parent: md-04gj
tags: [calendar, date-generation, locale]
---
# Implement reusable German calendar date generation

Implement reusable German month/weekday generation for calendar elements before month templates depend on it.

## Design

Create a small pure date-generation module that returns month names, weekday abbreviations, day numbers, weekday indexes, weekend flags, and leading/trailing grid positions for a fixed year/month with locale `de-DE` and Monday-first behavior where needed.

## Acceptance Criteria

Date generation is covered by tests for January and at least one month with different weekday alignment. German weekday/month labels are correct. Leap-year February is handled. The module is pure and has no React, Zustand, canvas, or Tauri dependencies.

## Notes

**2026-06-11T21:19:25Z**

Implemented pure src/calendarDates.ts German calendar date-generation module with de-DE month/weekday labels, Monday-first weekday indexes, weekend flags, and leading/trailing grid positions. Added Vitest coverage for January 2024, March 2024 alignment, German labels, and leap-year February 2024. Verified with pnpm vitest run src/__tests__/calendarDates.test.ts and pnpm typecheck.

**2026-06-11T21:19:52Z**

Follow-up: exported GERMAN_MONTH_NAMES and return cloned weekday label objects from generated months to keep consumers from sharing mutable label state.
