/**
 * `check` — validate every ticket's frontmatter. Returns a list of problems;
 * the CLI exits non-zero when any are found, so it doubles as a CI guard.
 *
 * Checks: parseable frontmatter + required fields, status is a known column (or
 * icebox), priority is configured, rank is numeric, id is unique, and the id
 * matches the filename.
 */

import * as fs from 'node:fs';
import { type TicketKitConfig, ticketsDirPath, statusOrder, ticketFilePattern } from './config.ts';
import { parseFrontmatter } from './lib.ts';

export interface Problem {
  file: string;
  message: string;
}

function checkOne(
  filename: string,
  content: string,
  config: TicketKitConfig,
  validStatuses: Set<string>,
  validPriorities: Set<string>,
): Problem[] {
  const problems: Problem[] = [];
  let ticket;
  try {
    ticket = parseFrontmatter(content, filename);
  } catch (err) {
    return [{ file: filename, message: err instanceof Error ? err.message : String(err) }];
  }
  if (!validStatuses.has(ticket.status)) {
    problems.push({ file: filename, message: `invalid status "${ticket.status}"` });
  }
  if (!validPriorities.has(ticket.priority)) {
    problems.push({ file: filename, message: `invalid priority "${ticket.priority}"` });
  }
  if (Number.isNaN(ticket.rank)) {
    problems.push({ file: filename, message: `rank is not a number` });
  }
  if (!filename.startsWith(`${ticket.id}-`)) {
    problems.push({ file: filename, message: `id "${ticket.id}" does not match filename` });
  }
  return problems;
}

export function checkTickets(rootDir: string, config: TicketKitConfig): Problem[] {
  const dir = ticketsDirPath(rootDir, config);
  if (!fs.existsSync(dir)) return [{ file: dir, message: 'tickets directory does not exist' }];

  const pattern = ticketFilePattern(config);
  const files = fs.readdirSync(dir).filter((f) => pattern.test(f));
  const validStatuses = new Set(statusOrder(config));
  const validPriorities = new Set(config.priorities);
  const seenIds = new Map<string, string>();
  const problems: Problem[] = [];

  for (const filename of files) {
    const content = fs.readFileSync(`${dir}/${filename}`, 'utf8');
    problems.push(...checkOne(filename, content, config, validStatuses, validPriorities));
    const idMatch = pattern.exec(filename);
    const id = `${config.idPrefix}-${idMatch?.[1] ?? ''}`;
    const prior = seenIds.get(id);
    if (prior) problems.push({ file: filename, message: `duplicate id ${id} (also ${prior})` });
    else seenIds.set(id, filename);
  }
  return problems;
}
