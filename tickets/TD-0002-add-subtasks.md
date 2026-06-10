---
id: TD-0002
title: Add subtasks
status: in-progress
priority: P0
rank: 10
area: features
pillars: [planning]
blocked-by: []
created: 2026-06-09
---

# TD-0002 · Add subtasks

## Why

Some tickets are really one piece of work with a few moving parts. A flat list
hides that structure; nesting it keeps the board honest about what's left.

## What

- An optional `parent: TD-NNNN` field on a child ticket (additive — no schema bump).
- The board nests children under their parent's card and shows a done/total badge.
- The detail page links a ticket to its parent and lists its subtasks.

## Acceptance

- [x] A child with `parent:` renders nested under the parent, not as a loose card.
- [x] The parent card shows a `[done/total]` badge.
- [ ] The detail page shows parent + subtask links.
