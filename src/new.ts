/**
 * `new` — scaffold a ticket file from a title. Auto-increments the id, writes
 * frontmatter + a body skeleton, and returns the created path.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type TicketKitConfig, ticketsDirPath, ticketFilePattern } from './config.ts';

export interface NewTicketOptions {
  title: string;
  priority?: string;
  area?: string;
  status?: string;
  /** Optional parent ticket id — makes this a subtask of that ticket. */
  parent?: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

/** Next zero-padded ticket number given the existing files. */
export function nextTicketNumber(filenames: string[], config: TicketKitConfig): string {
  const pattern = ticketFilePattern(config);
  let max = 0;
  for (const f of filenames) {
    const m = pattern.exec(f);
    if (m) max = Math.max(max, Number.parseInt(m[1] ?? '0', 10));
  }
  return String(max + 1).padStart(4, '0');
}

/** ISO date (YYYY-MM-DD) for the `created` field. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Make a value safe to interpolate as a single-line YAML frontmatter scalar.
 * Collapses any newline / carriage-return / other control char to a space so a
 * value can't break out of its line and inject extra frontmatter fields (the
 * same class of bug the `parent` id-check guards against, for free-text fields).
 */
function frontmatterScalar(value: string): string {
  return value.replace(/[\x00-\x1f\x7f]+/g, ' ').trim();
}

/**
 * Emit a free-text value as a valid double-quoted YAML scalar. JSON string
 * syntax is a subset of YAML's double-quoted flow scalar, so JSON.stringify
 * handles the cases plain scalars can't: a leading-keyword colon (`Fix: parser`),
 * a `#` that would otherwise start a comment (`foo # bar`), quotes, and brackets.
 * Used only for `title` and `area` (genuinely free text); `status`/`priority`
 * are controlled-vocabulary keys the parser/linter expect bare and unquoted.
 * Pair with frontmatterScalar (newlines already collapsed) before quoting.
 */
function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

export function buildTicketContent(
  id: string,
  opts: NewTicketOptions,
  config: TicketKitConfig,
): string {
  // `parent` is interpolated into frontmatter — require a clean ticket id so a
  // newline-bearing value can't inject extra frontmatter lines.
  if (opts.parent !== undefined && !new RegExp(`^${config.idPrefix}-\\d{4}$`).test(opts.parent)) {
    throw new Error(`parent must be a ticket id like ${config.idPrefix}-0001 (got "${opts.parent}")`);
  }
  // Free-text / token fields are interpolated as single-line YAML scalars; strip
  // line breaks so a crafted value (e.g. a title containing "\nstatus: done")
  // can't inject frontmatter. The title also flows into the body heading.
  const title = frontmatterScalar(opts.title);
  const status = frontmatterScalar(opts.status ?? config.columns[0]?.key ?? 'open');
  const priority = frontmatterScalar(opts.priority ?? config.priorities[Math.floor(config.priorities.length / 2)] ?? 'P2');
  const area = frontmatterScalar(opts.area ?? 'general');
  const parentLine = opts.parent ? `\nparent: ${opts.parent}` : '';
  return `---
id: ${id}
title: ${yamlScalar(title)}
status: ${status}
priority: ${priority}
rank: 100
area: ${yamlScalar(area)}
pillars: []
blocked-by: []${parentLine}
created: ${today()}
---

# ${id} · ${title}

## Why

_Why does this ticket exist? What problem or opportunity?_

## What

_What, concretely, gets done._

## Acceptance

- [ ] _the first observable outcome_
`;
}

export function createTicket(
  rootDir: string,
  config: TicketKitConfig,
  opts: NewTicketOptions,
): string {
  const dir = ticketsDirPath(rootDir, config);
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir);
  const num = nextTicketNumber(existing, config);
  const id = `${config.idPrefix}-${num}`;
  const filename = `${id}-${slugify(opts.title)}.md`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buildTicketContent(id, opts, config), 'utf8');
  return filePath;
}
