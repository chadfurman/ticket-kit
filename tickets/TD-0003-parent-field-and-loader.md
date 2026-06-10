---
id: TD-0003
title: Add the optional parent field
status: done
priority: P0
rank: 10
area: features
pillars: [planning]
blocked-by: []
parent: TD-0002
created: 2026-06-09
---

# TD-0003 · Add the optional parent field

## Why

Subtasks need a link to their parent that old tickets (without it) keep ignoring.

## What

- `Ticket.parent?: string`, parsed from frontmatter, absent ⇒ undefined.
- `check` validates that a present `parent` references a real ticket id.

## Acceptance

- [x] Tickets without `parent` still load and pass `check`.
- [x] A dangling `parent` is flagged by `check`.
