---
description: Show the ticket-kit board — regenerate the static dashboard and open it, or start the live server
---

You are showing the **ticket-kit** board for the current repo. Read the
`ticket-kit` skill first. Invoke the CLI as `node --experimental-transform-types
"$CLAUDE_PLUGIN_ROOT/src/cli.ts" <verb>` (the `--experimental-transform-types` flag is
**required** — it matches `package.json`), or `node --experimental-transform-types
src/cli.ts <verb>` in the ticket-kit repo, or the project's npm script if wired. If a
verb errors with a module-not-found / syntax error, the CLI isn't reachable — tell the
user to check the ticket-kit plugin is installed and they're on Node ≥ 22.6.

Pick the mode from `.tickets.json` (`"mode"`), or ask if it isn't set:

- **static** → run `generate` to (re)write `<ticketsDir>/board.html`, then tell the
  user the file path to open in a browser. No server stays running; re-run this to
  refresh. This works even if the user doesn't keep node around — you run it.
- **live** → start `serve` and give the user the URL (default
  `http://localhost:4317`). Remind them it's a server — it must stay running for the
  ~3s live updates.

If `$ARGUMENTS` names a mode (`static` / `live`), use that and skip the prompt.
