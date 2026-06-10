# ticket-kit-board memory

## XSS invariant (confidence: low — source: root CLAUDE.md; re-read before citing)

ALL HTML interpolation goes through escapeHtml (in src/lib.ts; escapes & < > ").
This is the non-negotiable XSS boundary — the board renders host-authored
markdown. Cite on every rendering review.

## Sharp edges (confidence: low — seeded from researcher map 2026-06-09; re-read before acting)

- **Client/server escape mirror:** serve.ts `buildLiveShell()` inlines a client-side JS `escHtml()` (~lines 85-87) re-implementing the four replacements. It MUST stay identical to the server escapeHtml; divergence is a silent XSS bug.
- **Detail page trusts markdown output unescaped:** detail.ts `buildDetailPage()` injects `renderMarkdown()` output UNESCAPED. Safe ONLY because the renderer emits a controlled tag set (`<code> <strong> <a> <h*> <p> <ul> <ol> <li> <table> <hr>`) and escapes user text first. A markdown.ts change that emits a new tag or skips escaping is an XSS hole.
- **renderInline stash order:** markdown.ts extracts code spans FIRST (placeholder stash), escapes the rest, then restores code spans with their own escape. Changing the order double-escapes or leaks raw HTML.
- **Sacred README markers:** generate.ts rewrites `tickets/README.md` between `<!-- TICKETS:START -->` and `<!-- TICKETS:END -->`. Load-bearing; never hand-edit between them; if absent, generate throws rather than corrupting.
- **serve vs generate:** same board logic; differ in freshness (serve re-reads .md per request; generate is a snapshot) and href (serve → `/ticket/<id>`; generate → filename).
- **Lint parity (commit ddfcce3):** serve.ts router branches were braced to avoid `return voidFn()` — this tool is vendored into strict-linter host repos. Keep that hygiene.

## Coverage gap (confidence: low)

Only test/markdown.test.ts covers the renderer. serve.ts HTTP routes and
generate.ts file output have NO automated tests. Flag when reviewing behaviour
changes there.

## Team conventions (learned-from: chadfurman, learned-from-date: 2026-06-09)

- Repo always merges to `main`; dogfoods ticket-kit (tickets/*.md) for tracking, not Jira.
