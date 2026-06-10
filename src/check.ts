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
import { SCHEMA_VERSION } from './version.ts';
import { dataSchemaVersion } from './migrate.ts';

export interface Problem {
  file: string;
  message: string;
}

/** Compare the project's declared data schema against what this kit supports. */
function schemaCompatProblem(config: TicketKitConfig): Problem | null {
  const data = dataSchemaVersion(config);
  if (data > SCHEMA_VERSION) {
    return {
      file: '.tickets.json',
      message: `schema v${data.toString()} is newer than this ticket-kit (supports v${SCHEMA_VERSION.toString()}) — update the kit`,
    };
  }
  if (data < SCHEMA_VERSION) {
    return {
      file: '.tickets.json',
      message: `schema v${data.toString()} is older than this ticket-kit (v${SCHEMA_VERSION.toString()}) — run "ticket-kit migrate"`,
    };
  }
  return null;
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
  const parentRefs: ParentRef[] = [];
  const problems: Problem[] = [];

  const compat = schemaCompatProblem(config);
  if (compat) problems.push(compat);

  for (const filename of files) {
    const content = fs.readFileSync(`${dir}/${filename}`, 'utf8');
    problems.push(...checkOne(filename, content, config, validStatuses, validPriorities));
    const idMatch = pattern.exec(filename);
    const id = `${config.idPrefix}-${idMatch?.[1] ?? ''}`;
    const parent = parseParentRef(content);
    if (parent) parentRefs.push({ file: filename, id, parent });
    const prior = seenIds.get(id);
    if (prior) problems.push({ file: filename, message: `duplicate id ${id} (also ${prior})` });
    else seenIds.set(id, filename);
  }

  problems.push(...validateParentGraph(parentRefs, new Set(seenIds.keys())));
  return problems;
}

interface ParentRef {
  file: string;
  id: string;
  parent: string;
}

/** Read the optional `parent:` field from raw frontmatter (null if absent/empty). */
function parseParentRef(content: string): string | null {
  try {
    return parseFrontmatter(content, 'x').parent ?? null;
  } catch {
    return null; // a malformed ticket is already reported by checkOne
  }
}

/**
 * Does walking `start`'s parent chain return to a ticket already on the path?
 * Valid chains are length ≤ 2 (one-level nesting); only a malformed cycle walks
 * longer, and it is bounded by the number of subtasks — so this stays linear.
 */
function hasParentCycle(start: string, parentOf: Map<string, string>): boolean {
  const seen = new Set<string>([start]);
  let cur = parentOf.get(start);
  while (cur !== undefined) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = parentOf.get(cur);
  }
  return false;
}

/**
 * A `parent` must reference a real ticket, the chain must not cycle, and nesting
 * is only one level deep (a parent may not itself be a subtask) — so the board
 * can render every ticket exactly once.
 */
function validateParentGraph(refs: ParentRef[], knownIds: Set<string>): Problem[] {
  const parentOf = new Map(refs.map((r) => [r.id, r.parent]));
  const problems: Problem[] = [];
  for (const { file, id, parent } of refs) {
    if (!knownIds.has(parent)) {
      problems.push({ file, message: `parent "${parent}" does not exist` });
    } else if (hasParentCycle(id, parentOf)) {
      problems.push({ file, message: `parent chain for ${id} forms a cycle` });
    } else if (parentOf.has(parent)) {
      problems.push({ file, message: `parent "${parent}" is itself a subtask — nesting is only one level deep` });
    }
  }
  return problems;
}
