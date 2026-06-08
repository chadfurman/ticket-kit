import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_CONFIG, loadConfig, writeSchemaVersion } from '../src/config.ts';
import {
  type Migration,
  planMigrations,
  dataSchemaVersion,
  migrate,
} from '../src/migrate.ts';
import { SCHEMA_VERSION } from '../src/version.ts';
import { checkTickets } from '../src/check.ts';

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-kit-mig-'));
}

const fakeList: Migration[] = [
  { from: 2, to: 3, describe: 'b', run: () => undefined },
  { from: 1, to: 2, describe: 'a', run: () => undefined },
];

test('dataSchemaVersion: absent ⇒ baseline 1, else the declared value', () => {
  assert.equal(dataSchemaVersion(DEFAULT_CONFIG), 1);
  assert.equal(dataSchemaVersion({ ...DEFAULT_CONFIG, schemaVersion: 4 }), 4);
});

test('planMigrations: only pending, in ascending order', () => {
  assert.deepEqual(
    planMigrations(1, fakeList).map((m) => m.describe),
    ['a', 'b'],
  );
  assert.deepEqual(
    planMigrations(2, fakeList).map((m) => m.describe),
    ['b'],
  );
  assert.deepEqual(planMigrations(3, fakeList), []);
});

test('migrate: no-op when data is already current', () => {
  const root = tmpRoot();
  const result = migrate(root, DEFAULT_CONFIG);
  assert.equal(result.from, SCHEMA_VERSION);
  assert.equal(result.to, SCHEMA_VERSION);
  assert.deepEqual(result.applied, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('migrate: refuses data newer than the kit', () => {
  assert.throws(
    () => migrate(tmpRoot(), { ...DEFAULT_CONFIG, schemaVersion: SCHEMA_VERSION + 5 }),
    /Update ticket-kit/,
  );
});

test('writeSchemaVersion: round-trips through .tickets.json', () => {
  const root = tmpRoot();
  writeSchemaVersion(root, 7);
  assert.equal(loadConfig(root).schemaVersion, 7);
  fs.rmSync(root, { recursive: true, force: true });
});

test('check: flags data schema newer than the kit', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, 'tickets'));
  fs.writeFileSync(path.join(root, '.tickets.json'), JSON.stringify({ schemaVersion: 999 }));
  const messages = checkTickets(root, loadConfig(root))
    .map((p) => p.message)
    .join('\n');
  assert.match(messages, /newer than this ticket-kit/);
  fs.rmSync(root, { recursive: true, force: true });
});
