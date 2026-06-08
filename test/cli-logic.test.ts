import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_CONFIG, mergeConfig } from '../src/config.ts';
import { slugify, nextTicketNumber, createTicket } from '../src/new.ts';
import { checkTickets } from '../src/check.ts';

test('mergeConfig: overrides only provided fields, keeps defaults', () => {
  const merged = mergeConfig({ idPrefix: 'BUG', port: 5000, columns: [] });
  assert.equal(merged.idPrefix, 'BUG');
  assert.equal(merged.port, 5000);
  assert.deepEqual(merged.ticketsDir, DEFAULT_CONFIG.ticketsDir);
  // empty columns array is rejected → keeps defaults
  assert.deepEqual(merged.columns, DEFAULT_CONFIG.columns);
});

test('slugify: lowercases, hyphenates, trims', () => {
  assert.equal(slugify('Improve the Onboarding!'), 'improve-the-onboarding');
  assert.equal(slugify('  Spaces  &  Symbols  '), 'spaces-symbols');
});

test('nextTicketNumber: max existing + 1, zero-padded', () => {
  const files = ['TD-0001-a.md', 'TD-0007-b.md', 'README.md', 'TD-0003-c.md'];
  assert.equal(nextTicketNumber(files, DEFAULT_CONFIG), '0008');
  assert.equal(nextTicketNumber([], DEFAULT_CONFIG), '0001');
});

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-kit-'));
}

test('createTicket → check: a scaffolded ticket passes the linter', () => {
  const root = tmpRoot();
  const file = createTicket(root, DEFAULT_CONFIG, { title: 'Test ticket', area: 'web' });
  assert.match(file, /TD-0001-test-ticket\.md$/);
  const problems = checkTickets(root, DEFAULT_CONFIG);
  assert.deepEqual(problems, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('check: flags invalid status, invalid priority, and duplicate ids', () => {
  const root = tmpRoot();
  const dir = path.join(root, 'tickets');
  fs.mkdirSync(dir);
  const fm = (id: string, status: string, priority: string): string =>
    `---\nid: ${id}\ntitle: t\nstatus: ${status}\npriority: ${priority}\nrank: 1\narea: a\npillars: []\nblocked-by: []\ncreated: 2026-06-08\n---\nbody\n`;
  fs.writeFileSync(path.join(dir, 'TD-0001-a.md'), fm('TD-0001', 'open', 'P1'));
  fs.writeFileSync(path.join(dir, 'TD-0002-b.md'), fm('TD-0002', 'bogus', 'P9'));
  fs.writeFileSync(path.join(dir, 'TD-0001-c.md'), fm('TD-0001', 'open', 'P1'));

  const problems = checkTickets(root, DEFAULT_CONFIG);
  const messages = problems.map((p) => p.message).join('\n');
  assert.match(messages, /invalid status "bogus"/);
  assert.match(messages, /invalid priority "P9"/);
  assert.match(messages, /duplicate id TD-0001/);
  fs.rmSync(root, { recursive: true, force: true });
});
