---
description: Manage the ticket-kit board — serve, generate, create, check, or triage tickets
---

You are operating the **ticket-kit** ticket system. Read the `ticket-kit` skill
first for the conventions and the frontmatter contract.

Interpret the argument (`$ARGUMENTS`) and act:

- **empty / `serve`** → start the live board (`ticket-kit serve`, or the project's
  `tickets:serve` script) and give the user the URL. Note it's a server — it must
  stay running.
- **`new <description>`** → dispatch the **ticket-author** agent to scaffold a
  ticket from the description.
- **`triage` / `groom` / `next` / `what should I work on`** → dispatch the
  **ticket-groomer** agent.
- **`generate`** → run `ticket-kit generate` to rewrite the README index + board.html.
- **`check`** → run `ticket-kit check` and report problems (non-zero exit = CI fail).

If the CLI isn't wired into an npm script, run it directly with
`node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts" <verb>` (the
`--experimental-transform-types` flag is **required** — it matches `package.json`), or
`node --experimental-transform-types <path-to>/ticket-kit/src/cli.ts <verb>` from a
local checkout. Locate the config (`.tickets.json`) and the tickets directory before
acting.
