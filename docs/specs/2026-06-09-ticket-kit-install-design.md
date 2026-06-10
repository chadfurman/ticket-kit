# ticket-kit install experience — design

**Status:** approved design (2026-06-09) · **Scope:** the install commands + README. The terminal animation is a separate fast-follow.

## Goal

Make ticket-kit **AI-first**: installing the plugin and running `/ticket-kit:install`
in a repo is the whole setup. The board is a bonus, not the headline.

## `/ticket-kit:install` (new `commands/install.md` — an agent procedure)

Run inside a host repo. It:

1. **Scaffolds data** if absent: `tickets/`, a `.tickets.json` (sensible defaults),
   and one starter ticket (so the board isn't empty). Idempotent — never clobbers
   existing tickets or config.
2. **Picks a run mode — ASK "live board or static dashboard?"**
   - **Static dashboard** (default): the AI runs `generate` on request to produce
     `tickets/board.html`; the user just opens the file. No long-running server. (The
     agent runs node from the plugin, so the user needn't keep node around to refresh.)
   - **Live**: a persistent `serve` process (~3s live updates; needs node running).
   Either way, wire it to run from the **installed plugin** —
   `node ${CLAUDE_PLUGIN_ROOT}/src/cli.ts <verb>` — and optionally add
   `tickets` / `tickets:serve` npm scripts. No `src/` vendoring.
   *(Build-time verify: the plugin CLI is invocable from `${CLAUDE_PLUGIN_ROOT}`
   against the host's cwd. If not, fall back to vendoring `src/`.)*
3. **Tracker negotiation:** detect an existing tracker — a Jira/Linear plugin in
   `enabledPlugins`, the Atlassian MCP, or change-factory's `ticketing` gate. If one
   is found, **ASK the user to confirm** disabling it *for this repo*. On yes:
   - write a project `.claude/settings.json` turning it off here
     (`enabledPlugins: { "<tracker>": false }` and/or `disabledMcpjsonServers`), and
   - add a `CLAUDE.md` line: "Work items live in ticket-kit (`tickets/*.md`), not <tracker>."
   On no: do nothing (advisory only). Never disable without the confirm.
4. **Prints next moves:** "add a ticket for X" → "add a subtask" → `/ticket-kit:serve`.

## `/ticket-kit:serve` (new `commands/serve.md`)

Convenience wrapper: **static** → regenerate `board.html` and tell the user to open
it; **live** → start the server and give the URL. Honors the mode chosen at install
(or asks if unset).

## README quickstart — the 6-step AI-first flow

1. `/plugin marketplace add chadfurman/ticket-kit` + `/plugin install ticket-kit@ticket-kit`
2. `/ticket-kit:install` in your repo
3. "add a ticket for X"
4. "add a subtask to do Y"
5. "let's start on Z" (the agents work it)
6. *(bonus)* `/ticket-kit:serve` → watch it on the board

Plus a light "pairs well with **change-factory**" pointer (named as a companion, not
used to explain how plugins install).

## Out of scope (fast-follow)

- The terminal animation (`docs/demo.gif`). Approach TBD: asciinema-of-real-session
  → GIF (authentic AI convo) vs VHS (CLI-only, simulated chat). README keeps the
  existing board screenshot until then.

## Risks / notes

- **Sensitive behavior:** the install command WRITES a project `.claude/settings.json`
  and disables another plugin. Must always confirm first, write only project-scoped
  settings (never the user's global), and be reversible.
- **No new TS code** is required — both commands are agent procedures that call the
  existing CLI + read/write settings. The ship review should focus on the
  settings-writing safety + README accuracy, not TDD.
