# CLAUDE.md — ticket-kit

Project memory + the rules that keep ticket-kit safe to drop into other repos.
Read this before changing anything in `src/`.

## What this is

A **stateless** ticket tool. The code (`src/`) is copied or cloned into a host
project; the host owns its **data**. The two never mix:

| Layer     | Lives in                              | Owned by      |
| --------- | ------------------------------------- | ------------- |
| **Logic** | `src/*.ts` (vendored as `tools/...`)  | ticket-kit    |
| **Data**  | `<ticketsDir>/*.md` + `.tickets.json` | the host repo |

Updating the logic must NEVER require touching a host's data — except through a
declared migration (below). That separation is the whole product. Guard it.

## The data contract (versioned)

The contract is the ticket **frontmatter shape** + the **`.tickets.json` shape**.
Its version is `SCHEMA_VERSION` in `src/version.ts`. A host's data declares the
version it was written in via `.tickets.json` → `schemaVersion` (absent ⇒ baseline 1).

**Frontmatter (every ticket):** `id, title, status, priority, rank, area,
pillars, blocked-by, created`, plus the *optional* `parent` (a ticket id — makes
it a subtask; the loader tolerates its absence). **Config keys:** `ticketsDir,
port, idPrefix, priorities, columns, title, schemaVersion`.

**Board conventions:** the **last (rightmost) column** is the "done" state — the
subtask `[done/total]` badge counts children whose `status` is that column key
(`isDoneStatus` in `lib.ts`; the live board mirrors it as `DONE_KEY` in `serve.ts`,
which must agree). Subtask nesting is **one level deep**: a child nests under a
top-level parent; a grandchild or a parent cycle degrades to a loose card and is
flagged by `check`.

### Change classes — know which you're making

- **Additive / safe (NO bump):** a new *optional* frontmatter field the loader
  tolerates when absent; a new *optional* config key with a default; a new CLI
  verb; board/markdown/rendering changes. Old data keeps working untouched.
- **Breaking (REQUIRES a bump + a migration):** removing, renaming, or retyping a
  frontmatter field or config key; changing the id format (`PREFIX-NNNN`);
  changing the meaning of an existing value; making an optional field required.

### Rules — non-negotiable

1. **A breaking change bumps `SCHEMA_VERSION` and adds a `Migration` in
   `src/migrate.ts`, in the SAME commit.** One without the other is a broken release.
2. **Migrations are append-only and ordered** (`from → to`, normally `+1`). Never
   edit or delete a shipped migration — hosts may be on any older version.
3. **The loader must never silently corrupt old data.** Either read it
   backward-compatibly, or have `check` refuse it with a clear "run
   `ticket-kit migrate`" message (this is wired — keep it working).
4. **`check` is the compatibility gate.** It already errors when a host's
   `schemaVersion` is newer than the kit, and prompts migration when older. Any
   breaking change must keep that detection honest.
5. **Keep a fixture of the previous schema** under `test/fixtures/` and a test that
   the migration upgrades it and `check` then passes. Prove the path, don't assert it.
6. **Bump `KIT_VERSION` (and `package.json` version) on every release**; bump
   `SCHEMA_VERSION` only on a breaking data change. They are independent.

## How a host updates ticket-kit

1. Re-copy `src/` over the vendored dir (e.g. `tools/tickets/`), or `git pull`
   if cloned. **Data in `<ticketsDir>/` is not touched.**
2. Run `ticket-kit check`. If it says the schema is older than the kit → run
   `ticket-kit migrate` (transforms the tickets, stamps the new `schemaVersion`).
   If it says the data is *newer* than the kit → the host pulled stale code; update it.
3. Run `ticket-kit generate` to refresh the index/board.

`ticket-kit version` prints the kit + schema versions so a host can see drift.

## Code shape

- Zero runtime dependencies — Node built-ins only. Dev-only: typescript + @types/node.
- Functions ≤ 50 lines, ≤ 2 levels of nesting.
- Tests are `node:test`; everything logic-bearing has one. `npm test` + `npm run typecheck` stay green.
- All HTML interpolation goes through `escapeHtml` — the board renders host-authored
  markdown; never inject unescaped values.

## Tests

`npm test` runs the `node:test` suite. `npm run typecheck` runs `tsc --noEmit`.
Both must pass before a release or a re-vendor.

## change-factory experts

This repo is set up with change-factory (shared mode). Two per-repo experts own
`src/` — consult the relevant one before changing its files:

- **ticket-kit-core** — the versioned data contract (`version`, `migrate`, `check`,
  `config`, `lib`, `new`, `cli`). Enforces the schema-bump + migration rules above.
- **ticket-kit-board** — the rendering pipeline (`serve`, `generate`, `markdown`,
  `detail`) and the `escapeHtml` XSS boundary.

Run `/cf` to orient, `/cf "build X"` to route substantive work through the chain,
or `/cf upgrade` to health-check the experts. Experts + memory live under
`.claude/agents/` and `.claude/agent-memory/`.
