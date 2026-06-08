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

export function buildTicketContent(
  id: string,
  opts: NewTicketOptions,
  config: TicketKitConfig,
): string {
  const status = opts.status ?? config.columns[0]?.key ?? 'open';
  const priority = opts.priority ?? config.priorities[Math.floor(config.priorities.length / 2)] ?? 'P2';
  const area = opts.area ?? 'general';
  return `---
id: ${id}
title: ${opts.title}
status: ${status}
priority: ${priority}
rank: 100
area: ${area}
pillars: []
blocked-by: []
created: ${today()}
---

# ${id} · ${opts.title}

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
