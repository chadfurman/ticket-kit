# src/ — ticket-kit logic

The stateless ticket-kit logic, split across two change-factory expert domains.
Consult the relevant expert before changing a file it owns.

consult-expert: ticket-kit-core
consult-expert: ticket-kit-board

- **ticket-kit-core** owns the versioned data contract: `version.ts`, `migrate.ts`,
  `check.ts`, `config.ts`, `lib.ts`, `new.ts`, `cli.ts`. Schema bumps + migrations
  live here — see root `CLAUDE.md § "The data contract"`.
- **ticket-kit-board** owns the rendering pipeline: `serve.ts`, `generate.ts`,
  `markdown.ts`, `detail.ts`. The `escapeHtml` XSS boundary is its first duty.

`lib.ts` is core-owned but its `escapeHtml`/`buildCard`/`buildColumnHtml` helpers
are consumed by the board files — changes there are a cross-expert concern.
