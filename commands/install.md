---
description: Set up ticket-kit in this repo — scaffold tickets, pick a run mode, and (if another tracker is installed) offer to disable it here
---

You are setting up **ticket-kit** in the current repository. Read the `ticket-kit`
skill first for the conventions. Work from the repo root. Be idempotent — never
clobber existing tickets or config.

### Running the CLI (do this probe FIRST)

Invoke the CLI as `node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts" <verb>`
— the `--experimental-transform-types` flag is **required** and matches how the repo
runs it (`package.json`). In the ticket-kit repo itself use `node
--experimental-transform-types src/cli.ts <verb>`, or any wired `tickets` npm script.

**Probe before doing anything else:** run `… version`. If it errors (e.g.
`$CLAUDE_PLUGIN_ROOT` is unset, the plugin isn't installed, or Node < 22.6), STOP and
tell the user plainly: "ticket-kit's CLI isn't reachable — make sure the ticket-kit
plugin is installed and you're on Node ≥ 22.6, then re-run." Don't limp along firing
verbs that will each fail.

### Upgrade vs first-time

If ticket-kit is **already set up** here — there are ticket files matching
`<ticketsDir>/<PREFIX>-NNNN-*.md` (an empty `tickets/` dir does NOT count) — this is an
**upgrade**: skip scaffolding and run `check` → if it says the data schema is *older*
than the kit, `migrate` → `generate`; report versions + what changed, then stop. (Same
as `/ticket-kit:upgrade`.) Otherwise do the first-time setup below.

### 1. Scaffold the data (first-time setup)

- No ticket files yet → create the first one so the board isn't empty:
  `… new "set up ticket-kit"` (this creates `tickets/` + the ticket).
- `.tickets.json`: if absent, offer to write one with the project's `title` (other
  keys are optional — defaults are fine). If it exists, **read it first** — if it
  doesn't parse, surface that to the user (every later `check`/`generate` would fail on
  it); if it parses, leave existing values untouched and only add missing keys.

### 2. Pick a run mode — ASK the user

> "How do you want to view the board — a **static dashboard** (regenerate an HTML file
> you open in a browser; no server) or a **live** board (a running server with ~3s
> updates)?"

Record the choice in `.tickets.json` as `"mode": "static" | "live"`. Wire npm scripts
that point at the plugin CLI **with the flag**, e.g.
`"tickets": "node --experimental-transform-types \"$CLAUDE_PLUGIN_ROOT/src/cli.ts\""`
plus `tickets:serve` / `tickets:generate`. The user runs the board via `/ticket-kit:serve`.

### 3. Tracker negotiation (the sensitive step — always confirm)

Look for work trackers the AI might otherwise use instead of ticket-kit:
- tracker plugins in `enabledPlugins` (names like Jira / Linear / Atlassian / Shortcut
  / Asana — best-effort, you may not recognize an in-house one),
- a connected tracker MCP (e.g. the Atlassian MCP),
- change-factory's ticketing gate (`.claude/agent-lint.config` → `ticketing.enabled: true`).

**Enumerate ALL matches and show the user the full list** — don't act on a single
inferred match. Then ask which (if any) to disable for this repo. For each one the user
**explicitly confirms by name**, state the exact file **and** key/value before writing
it (always a **project-scoped** path under `./.claude/`, NEVER the user's global
`~/.claude/`), then merge into any existing settings without clobbering other keys:
- a plugin → "add `enabledPlugins.<tracker> = false` to `./.claude/settings.json`?" 
- an MCP → "add `<server>` to `disabledMcpjsonServers` in `./.claude/settings.json`?"
- change-factory → "set `ticketing.enabled: false` in `./.claude/agent-lint.config`?"

Then add a `CLAUDE.md` line: "Work items live in ticket-kit (`tickets/*.md`), not
<tracker>." If the user declines (or you found nothing), change nothing.

### 4. Mark the README — "tasks managed by ticket-kit"

Add a small badge + one line near the top of the **host** repo's README so anyone
landing on it sees where the work lives. **Idempotent:** if a `tasks-ticket--kit`
badge is already present, skip this step.

- Find the README (`README.md`, else `README.rst`/`readme.*`). If none exists, offer
  to create a minimal one — don't force it.
- Insert **right after the first `# H1`** (or at the very top if there's no H1):

  ```markdown
  [![tasks: ticket-kit](https://img.shields.io/badge/tasks-ticket--kit-7aa2ff)](https://ticket-kit.chads.website/)

  This project's tasks are managed by [ticket-kit](https://ticket-kit.chads.website/) — see `tickets/*.md`.
  ```

Keep it to the one badge + one line; don't restyle the rest of their README.

### 5. Tell the user what's next

Print the AI-first loop:
- "add a ticket for <X>" → the **ticket-author** agent writes it
- "add a subtask to <ticket>" → a child ticket (`parent:`)
- "what should I work on next?" → the **ticket-groomer** agent triages
- `/ticket-kit:serve` → see the board
