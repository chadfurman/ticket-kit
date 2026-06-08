# ticket-kit

A **file-based ticket system** you drop into any project. Every ticket is a
markdown file with YAML frontmatter; a live neon board renders them; a tiny CLI
creates, validates, and serves them. **Zero runtime dependencies** — just Node.
The git history is your audit log.

It also ships as a **Claude Code plugin** (a skill + two agents + a `/tickets`
command), so the AI can author and triage tickets in any repo it's dropped into.

```
┌──────────┐   ┌─────────────┐   ┌──────────────┐
│ tickets/ │ → │ ticket-kit  │ → │ live board   │
│ *.md     │   │ serve / gen │   │ + detail page│
└──────────┘   └─────────────┘   └──────────────┘
   the data       the tool          the view
```

## Why file-based?

- **Diffable & reviewable** — tickets move through git like code. No DB, no export.
- **Portable** — copy the folder into any repo; it just runs.
- **AI-native** — "the AI manages the tickets." The board is read-only; changes
  happen by editing files (by you or by the agents), so every change is a commit.

## Get it into your project

**Copy-in** (matches the "just drop it in" workflow):

```bash
cp -r ticket-kit/ my-project/ticket-kit/
# or clone it as its own thing:
git clone <repo-url> ticket-kit
```

Then, from your project root:

```bash
node ticket-kit/src/cli.ts new "my first ticket"
node ticket-kit/src/cli.ts serve     # → http://localhost:4317
```

Optionally wire npm scripts in your project's `package.json`:

```json
{
  "scripts": {
    "tickets": "node ticket-kit/src/cli.ts",
    "tickets:serve": "node ticket-kit/src/cli.ts serve"
  }
}
```

> Requires Node ≥ 22 (uses built-in TypeScript type-stripping). The `serve` and
> board features are pure Node — nothing to `npm install`.

## CLI

| Command                              | What it does                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `ticket-kit serve`                   | Live board, auto-refreshes ~3s. Cards open a rendered detail page. |
| `ticket-kit generate`                | Rewrite the README index + static `board.html`.          |
| `ticket-kit new "<title>"`           | Scaffold a ticket. `--priority P1 --area web --status open`. |
| `ticket-kit check`                   | Validate all frontmatter; exits non-zero on problems (CI guard). |
| `ticket-kit help`                    | Usage.                                                   |

## Configuration — `.tickets.json` (optional)

Drop this at your project root to override any default:

```json
{
  "title": "My Project",
  "ticketsDir": "tickets",
  "port": 4317,
  "idPrefix": "TD",
  "priorities": ["P0", "P1", "P2", "P3"],
  "columns": [
    { "key": "open", "label": "Open" },
    { "key": "in-progress", "label": "In Progress" },
    { "key": "done", "label": "Done" }
  ]
}
```

No config file? It defaults to `tickets/`, port `4317`, prefix `TD`, and the three
columns above. `idPrefix` lets a bug tracker use `BUG-0001`, a roadmap use `RM-0001`, etc.

## The ticket format

```yaml
---
id: TD-0001              # PREFIX-NNNN, matches the filename
title: Short imperative title
status: open             # a column key, or "icebox" (hidden until promoted)
priority: P0             # one of the configured priorities (P0 = most urgent)
rank: 20                 # tie-breaker within column+priority; lower floats higher
area: web                # free-form domain tag
pillars: [low-stress]    # optional project themes
blocked-by: [TD-0003]    # ids this waits on
created: 2026-06-08
---

# TD-0001 · Title

## Why
…the problem / opportunity.

## What
…what concretely gets done.

## Acceptance
- [ ] an observable outcome
```

Sort order on the board: **column → priority → rank → id**. Tickets with
`status: icebox` stay off the board (toggle "show icebox" on the live view).

## The board

- **Live view** (`serve`) — polls the files every ~3s, so editing a `.md` updates
  the board without a restart. Live search, priority/area filters, icebox toggle.
- **Detail page** — clicking a card renders the ticket's markdown (headings,
  tables, checkbox lists, code, links) as a styled page.
- **Static snapshot** (`generate`) — `board.html` you can open via `file://`, plus
  a markdown index table written into `tickets/README.md`.

## Claude Code plugin

`ticket-kit` is also a plugin. Point Claude Code at this directory (it has a
`.claude-plugin/plugin.json`) and you get:

- **`ticket-kit` skill** — orients Claude on the system, the frontmatter contract,
  and the CLI.
- **`ticket-author` agent** — turns an idea/bug/request into a well-formed ticket
  (real Why/What/Acceptance, sensible area/priority, dedup check).
- **`ticket-groomer` agent** — triages the whole board: re-ranks, sweeps statuses,
  unblocks, promotes from icebox, answers "what should I work on next".
- **`/tickets` command** — `serve`, `generate`, `new <desc>`, `triage`, `check`.

## Develop ticket-kit itself

```bash
npm install          # dev-only: typescript + @types/node (runtime needs nothing)
npm test             # node:test suite
npm run typecheck    # tsc --noEmit
```

## License

MIT.
