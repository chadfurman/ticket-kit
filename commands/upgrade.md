---
description: Reconcile this repo's tickets after the ticket-kit plugin updated — runs check, migrates if the data schema is older, and regenerates the board
---

You are **upgrading** ticket-kit's data in the current repo after the plugin's
code was updated (a new kit version). The code travels with the plugin; this
command brings the repo's **data** into line. Read the `ticket-kit` skill first.

Invoke the CLI as `node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts"
<verb>` (the `--experimental-transform-types` flag is **required** — it matches
`package.json`), or `node --experimental-transform-types src/cli.ts <verb>` in the
ticket-kit repo itself. Then:

1. **`version`** — print the kit + data-schema versions so the user sees any drift.
   If this errors (`$CLAUDE_PLUGIN_ROOT` unset / plugin not installed / Node < 22.6),
   STOP and tell the user to check the plugin install + Node ≥ 22.6 — don't run on.
2. **`check`** — the compatibility gate:
   - If it says the data schema is **older** than the kit → run **`migrate`**
     (transforms the tickets, stamps the new `schemaVersion`), then re-run `check`.
   - If it says the data is **newer** than the kit → the plugin is stale: tell the
     user to update the ticket-kit plugin (`/plugin` → update), and do **not** touch
     the data.
   - If it reports other problems → list them; don't migrate around them.
3. **`generate`** — refresh the README index + `board.html`.
4. Report what happened: versions before/after, whether a migration ran, and the
   `check` result.

This never edits ticket *content* except through a declared migration — see
`CLAUDE.md` § "The data contract".
