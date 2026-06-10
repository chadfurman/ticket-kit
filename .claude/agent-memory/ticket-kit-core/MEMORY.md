# ticket-kit-core memory

## Key code facts (confidence: low — seeded from researcher map 2026-06-09, not my own reading; re-read before citing)

- `version.ts`: KIT_VERSION='0.2.0', SCHEMA_VERSION=1, BASELINE_SCHEMA_VERSION=1. Data with no declared `schemaVersion` in `.tickets.json` ⇒ baseline 1.
- `migrate.ts`: MIGRATIONS=[] (empty — v0.2.0 shipped the framework, no migrations yet). planMigrations() loops from current → SCHEMA_VERSION in ascending order; migrate() applies; writeSchemaVersion() stamps `.tickets.json` after a successful run. `Migration.run` idempotency is a JSDoc contract ONLY — no test enforces it. Flag on every new migration.
- `config.ts`: mergeConfig() rejects empty `priorities`/`columns` arrays (falls back to defaults). SHARP EDGE: a typo'd config key (e.g. `ticketDir` vs `ticketsDir`) silently reverts to default — no user-visible error.
- `lib.ts`: parseFrontmatter() is hand-rolled, regex-free, colon-delimited — NOT full YAML. Arrays inline as `[a, b]`. SHARP EDGE: stops at the second `---` fence — a `---` in a ticket title/body truncates parsing. escapeHtml + buildCard/buildColumnHtml also live here and are consumed by ticket-kit-board.
- `new.ts`: nextTicketNumber() scans files for the max id and returns zero-padded +1. SHARP EDGE: no file locking — two parallel `ticket-kit new` calls can collide on an id. Single-process CLI assumption.
- `check.ts`: validates frontmatter syntax, required fields, valid status/priority, numeric rank, id-matches-filename, unique ids, AND schema compat (both drift directions). checkTickets() returns Problem[] — empty = clean.
- `cli.ts`: hand-rolled 54-line arg parser, zero deps. Verbs: serve, generate, new, check, migrate, version.

## Invariants to always cite (source: CLAUDE.md § "The data contract")

- Breaking change = SCHEMA_VERSION bump + Migration in the SAME commit + fixture + test. One without the others is a broken release.
- Migrations are append-only, ascending, never edited/deleted after shipping.
- KIT_VERSION (code) and SCHEMA_VERSION (data) are independent version axes.

## Team conventions (learned-from: chadfurman, learned-from-date: 2026-06-09)

- This repo dogfoods its own tool: work items live in `tickets/*.md`, not Jira.
- Merges go directly to `main` — no long-lived feature branches assumed.
