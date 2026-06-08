/**
 * ticket-kit configuration.
 *
 * A project using ticket-kit may drop a `.tickets.json` at its root to override
 * any of these. Everything has a sane default, so a brand-new project with no
 * config file still works — it just looks for `tickets/` and serves on 4317.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Column {
  key: string;
  label: string;
}

export interface TicketKitConfig {
  /** Directory (relative to project root) holding the TD-NNNN-*.md files. */
  ticketsDir: string;
  /** Port the live board serves on. */
  port: number;
  /** Id prefix for tickets, e.g. "TD" → TD-0001. Letters only. */
  idPrefix: string;
  /** Allowed priority values, highest urgency first. */
  priorities: string[];
  /** Board columns, left to right. A ticket's `status` must match a key (or "icebox"). */
  columns: Column[];
  /** Board heading. */
  title: string;
  /** The data-contract version this project's tickets are written in. Absent ⇒ baseline. */
  schemaVersion?: number;
}

export const DEFAULT_CONFIG: TicketKitConfig = {
  ticketsDir: 'tickets',
  port: 4317,
  idPrefix: 'TD',
  priorities: ['P0', 'P1', 'P2', 'P3'],
  columns: [
    { key: 'open', label: 'Open' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'done', label: 'Done' },
  ],
  title: 'Tickets',
};

const CONFIG_FILE = '.tickets.json';

function isColumnArray(value: unknown): value is Column[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        typeof c === 'object' && c !== null && typeof (c as Column).key === 'string' && typeof (c as Column).label === 'string',
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Merge a parsed `.tickets.json` object over the defaults, field by field. */
export function mergeConfig(raw: Record<string, unknown>): TicketKitConfig {
  const merged: TicketKitConfig = { ...DEFAULT_CONFIG };
  if (typeof raw['ticketsDir'] === 'string') merged.ticketsDir = raw['ticketsDir'];
  if (typeof raw['port'] === 'number') merged.port = raw['port'];
  if (typeof raw['idPrefix'] === 'string') merged.idPrefix = raw['idPrefix'];
  if (typeof raw['title'] === 'string') merged.title = raw['title'];
  if (typeof raw['schemaVersion'] === 'number') merged.schemaVersion = raw['schemaVersion'];
  if (isStringArray(raw['priorities']) && raw['priorities'].length > 0) merged.priorities = raw['priorities'];
  if (isColumnArray(raw['columns']) && raw['columns'].length > 0) merged.columns = raw['columns'];
  return merged;
}

/** Stamp the schema version into `.tickets.json` (creating it if absent). */
export function writeSchemaVersion(rootDir: string, version: number): void {
  const file = path.join(rootDir, CONFIG_FILE);
  const raw: Record<string, unknown> = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)
    : {};
  raw['schemaVersion'] = version;
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

/** Load `.tickets.json` from `rootDir` (defaults to cwd), falling back to defaults. */
export function loadConfig(rootDir: string = process.cwd()): TicketKitConfig {
  const file = path.join(rootDir, CONFIG_FILE);
  if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  return mergeConfig(raw);
}

/** Absolute path to the tickets directory for a given root + config. */
export function ticketsDirPath(rootDir: string, config: TicketKitConfig): string {
  return path.isAbsolute(config.ticketsDir)
    ? config.ticketsDir
    : path.join(rootDir, config.ticketsDir);
}

/** Status keys that render as board columns (everything except the implicit icebox). */
export function columnKeys(config: TicketKitConfig): string[] {
  return config.columns.map((c) => c.key);
}

/** Full status ordering used for sorting: columns in order, then icebox last. */
export function statusOrder(config: TicketKitConfig): string[] {
  return [...columnKeys(config), 'icebox'];
}

/** The file-name / id regex for this prefix, e.g. /^TD-(\d{4})-.+\.md$/. */
export function ticketFilePattern(config: TicketKitConfig): RegExp {
  return new RegExp(`^${config.idPrefix}-(\\d{4})-.+\\.md$`);
}
