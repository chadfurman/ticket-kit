---
id: TD-0004
title: Nest subtasks on the board with a badge
status: done
priority: P1
rank: 20
area: features
pillars: [planning]
blocked-by: []
parent: TD-0002
created: 2026-06-09
---

# TD-0004 · Nest subtasks on the board with a badge

## Why

Seeing subtasks inline under their parent is the whole point — the board should
show progress at a glance.

## What

- `buildColumnHtml` pulls children out of their own column and nests them under
  the parent card; the live board mirrors it client-side.
- The parent card carries a `[done/total]` badge.

## Acceptance

- [x] Static and live boards render nesting identically.
- [x] All interpolation still goes through `escapeHtml`.
