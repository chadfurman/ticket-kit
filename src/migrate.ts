/**
 * Data migrations — the path from an older data-contract version to the current
 * one (`SCHEMA_VERSION`).
 *
 * The registry is empty until the first breaking schema change. When you make
 * one, you add a Migration here AND bump SCHEMA_VERSION in version.ts in the same
 * commit (CLAUDE.md enforces this). A migration is a pure transform over the
 * tickets directory; after all apply, `.tickets.json` is stamped with the new
 * version so `check` / `migrate` know the data is current.
 */

import { type TicketKitConfig, ticketsDirPath, writeSchemaVersion } from './config.ts';
import { SCHEMA_VERSION, BASELINE_SCHEMA_VERSION } from './version.ts';

export interface Migration {
  /** Schema version this upgrades FROM. */
  from: number;
  /** Schema version this upgrades TO (normally from + 1). */
  to: number;
  /** One line describing what it changes. */
  describe: string;
  /** Transform the tickets in `ticketsDir`. Must be idempotent-safe to re-run. */
  run: (ticketsDir: string, config: TicketKitConfig) => void;
}

/** Registered migrations, ascending. EMPTY until the first breaking change. */
export const MIGRATIONS: Migration[] = [];

export interface MigrateResult {
  from: number;
  to: number;
  applied: string[];
}

/** The schema version a project's data declares (absent ⇒ baseline). */
export function dataSchemaVersion(config: TicketKitConfig): number {
  return config.schemaVersion ?? BASELINE_SCHEMA_VERSION;
}

/** Migrations needed to bring `from` up to current, in order. */
export function planMigrations(from: number, list: Migration[] = MIGRATIONS): Migration[] {
  return list.filter((m) => m.from >= from).sort((a, b) => a.from - b.from);
}

/** Apply all pending migrations and stamp the new schema version. */
export function migrate(rootDir: string, config: TicketKitConfig): MigrateResult {
  const from = dataSchemaVersion(config);
  if (from > SCHEMA_VERSION) {
    throw new Error(
      `Tickets are schema v${from.toString()} but this ticket-kit supports only ` +
        `v${SCHEMA_VERSION.toString()}. Update ticket-kit before opening these tickets.`,
    );
  }
  const dir = ticketsDirPath(rootDir, config);
  const applied: string[] = [];
  for (const m of planMigrations(from)) {
    m.run(dir, config);
    applied.push(`v${m.from.toString()}→v${m.to.toString()}: ${m.describe}`);
  }
  if (from !== SCHEMA_VERSION) writeSchemaVersion(rootDir, SCHEMA_VERSION);
  return { from, to: SCHEMA_VERSION, applied };
}
