---
name: ticket-kit
description: Use when the user wants to create, triage, prioritize, view, or check project tickets — anything about "the tickets", "the board", "the backlog", a TD-NNNN item, or "what should I work on next". Orients you on the file-based ticket system and when to dispatch the ticket-author / ticket-groomer agents.
---

# ticket-kit

A file-based ticket system: every ticket is a markdown file with YAML
frontmatter, the board is generated from those files, and **the AI manages the
tickets** — the board itself is read-only. There is no database. The git history
*is* the audit log.

## Where things live

- Tickets: `<ticketsDir>/<PREFIX>-NNNN-<slug>.md` (default `tickets/`, prefix `TD`).
- Config (optional): `.tickets.json` at the project root overrides `ticketsDir`,
  `port`, `idPrefix`, `priorities`, `columns`, `title`. Read it first if present;
  otherwise assume the defaults above.
- The CLI: run it however this project exposes it — a `tickets` / `tickets:serve`
  npm script, or directly `node <path-to>/ticket-kit/src/cli.ts <verb>`.

## The frontmatter contract (every ticket has all of these)

```yaml
---
id: TD-0001              # PREFIX-NNNN, matches the filename
title: Short imperative title
status: open             # one of the column keys, or "icebox"
priority: P0             # one of the configured priorities (P0 = most urgent)
rank: 20                 # tie-breaker within a column+priority; lower = higher
area: web                # free-form domain tag (web, engine, infra, …)
pillars: [low-stress]    # optional project themes a ticket serves
blocked-by: [TD-0003]    # ids this ticket waits on
created: 2026-06-08
---
```

Body sections, in order: `## Why`, `## What`, `## Acceptance` (checkboxes).

## CLI verbs

| Verb       | Use                                                            |
| ---------- | ------------------------------------------------------------- |
| `serve`    | Live board (auto-refreshes ~3s). Cards open a rendered detail page. |
| `generate` | Rewrite the README index + static `board.html`.               |
| `new "<title>"` | Scaffold a ticket (`--priority --area --status`).        |
| `check`    | Validate all frontmatter; non-zero exit on problems (CI guard). |

After editing any ticket, run `generate` so the README index stays current, and
`check` so frontmatter stays valid.

## When to dispatch which agent

- **Creating a ticket from an idea / bug / request** → dispatch **ticket-author**.
  It picks area/priority/pillars, scaffolds the file, and writes a real
  Why/What/Acceptance — not a stub.
- **"What should I work on?", triage, re-prioritize, find stale or blocked work,
  promote from icebox, sweep statuses** → dispatch **ticket-groomer**. It reads
  the whole board and proposes (or applies) status/rank/priority changes.
- **Just viewing** → run `serve` and point the user at the URL; don't dispatch an agent.

## Principles

- One fact per ticket; keep the body tight. Link related tickets by id in `blocked-by`.
- Never hand-edit the generated index between the `<!-- TICKETS:START/END -->`
  markers — regenerate it.
- Status moves are deliberate (the AI moves them); the board never writes back.
- Iced ideas get `status: icebox`; they stay off the board until promoted.
