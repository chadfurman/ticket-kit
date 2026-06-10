# validator/CLAUDE.md — repo-specific validation guidance

Repo-specific guidance for the `validator` agent. Complementary to the
auto-discovered run-plan; read at discovery to inform tier decisions.

<!-- cf:managed-start -->
<!-- Managed by change-factory. Doctor reconcile edits only inside these fences. -->

## Plugin scaffold (v0.54.0)

<!-- cf:managed-end -->

---

## Canonical validate command

```
npm test && npm run typecheck
```

ticket-kit is a zero-runtime-dependency TypeScript CLI/library. There is no
server boot, database, or external service to stand up — validation is the
`node:test` suite plus `tsc --noEmit`. Both must exit 0.

## Boot environment variables

None. The tool reads only the local `.tickets.json` + `tickets/*.md`; no env
vars or secrets are involved.

## What "green" means for this repo

All `node:test` cases pass (`npm test`, exit 0) AND `npm run typecheck` is clean.
No warnings are expected. A non-zero exit from either is a real failure — there
are no known-flaky suites.

## Never-run guardrails

Nothing destructive exists in this repo's scripts. `ticket-kit migrate` mutates
host ticket data — never run it against real `tickets/` during a validate pass;
use a fixture/tmp dir.

## Teardown gotchas

None — the test suite uses tmp dirs and cleans up after itself; no containers,
ports, or volumes.
