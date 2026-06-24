import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_CONFIG, mergeConfig } from '../src/config.ts';
import { slugify, nextTicketNumber, createTicket, buildTicketContent } from '../src/new.ts';
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

test('check: flags a parent that references a non-existent ticket, accepts a real one', () => {
  const root = tmpRoot();
  const dir = path.join(root, 'tickets');
  fs.mkdirSync(dir);
  const fm = (id: string, extra = ''): string =>
    `---\nid: ${id}\ntitle: t\nstatus: open\npriority: P1\nrank: 1\narea: a\npillars: []\nblocked-by: []\n${extra}created: 2026-06-08\n---\nbody\n`;
  fs.writeFileSync(path.join(dir, 'TD-0001-a.md'), fm('TD-0001'));
  fs.writeFileSync(path.join(dir, 'TD-0002-b.md'), fm('TD-0002', 'parent: TD-0001\n')); // valid
  fs.writeFileSync(path.join(dir, 'TD-0003-c.md'), fm('TD-0003', 'parent: TD-9999\n')); // dangling

  const messages = checkTickets(root, DEFAULT_CONFIG).map((p) => p.message).join('\n');
  assert.match(messages, /parent "TD-9999" does not exist/);
  assert.doesNotMatch(messages, /TD-0001.*does not exist/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('check: flags a parent cycle and a grandchild (nesting is one level deep)', () => {
  const root = tmpRoot();
  const dir = path.join(root, 'tickets');
  fs.mkdirSync(dir);
  const fm = (id: string, extra = ''): string =>
    `---\nid: ${id}\ntitle: t\nstatus: open\npriority: P1\nrank: 1\narea: a\npillars: []\nblocked-by: []\n${extra}created: 2026-06-08\n---\nbody\n`;
  // cycle: TD-0001 ↔ TD-0002
  fs.writeFileSync(path.join(dir, 'TD-0001-a.md'), fm('TD-0001', 'parent: TD-0002\n'));
  fs.writeFileSync(path.join(dir, 'TD-0002-b.md'), fm('TD-0002', 'parent: TD-0001\n'));
  // grandchild chain: TD-0003 ← TD-0004 ← TD-0005
  fs.writeFileSync(path.join(dir, 'TD-0003-c.md'), fm('TD-0003'));
  fs.writeFileSync(path.join(dir, 'TD-0004-d.md'), fm('TD-0004', 'parent: TD-0003\n'));
  fs.writeFileSync(path.join(dir, 'TD-0005-e.md'), fm('TD-0005', 'parent: TD-0004\n'));

  const messages = checkTickets(root, DEFAULT_CONFIG).map((p) => p.message).join('\n');
  assert.match(messages, /forms a cycle/);
  assert.match(messages, /nesting is only one level deep/);
  // a valid first-level subtask (TD-0004 → TD-0003) must NOT be flagged
  assert.doesNotMatch(messages, /parent "TD-0003" is itself a subtask/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('buildTicketContent: rejects a parent that is not a clean ticket id (frontmatter injection)', () => {
  assert.throws(
    () => buildTicketContent('TD-0001', { title: 't', parent: 'TD-0002\nstatus: done' }, DEFAULT_CONFIG),
    /parent must be a ticket id/,
  );
  assert.throws(
    () => buildTicketContent('TD-0001', { title: 't', parent: 'garbage' }, DEFAULT_CONFIG),
    /parent must be a ticket id/,
  );
  const ok = buildTicketContent('TD-0001', { title: 't', parent: 'TD-0002' }, DEFAULT_CONFIG);
  assert.match(ok, /parent: TD-0002/);
});

test('buildTicketContent: a newline-bearing title cannot inject frontmatter', () => {
  const out = buildTicketContent(
    'TD-0001',
    { title: 'Innocent\nstatus: done\npriority: P0' },
    DEFAULT_CONFIG,
  );
  // The injected lines must be collapsed into the single (quoted) title scalar,
  // not become their own frontmatter fields.
  assert.match(out, /title: "Innocent status: done priority: P0"/);
  assert.doesNotMatch(out, /\nstatus: done/);
  assert.doesNotMatch(out, /\npriority: P0/);
  // The body heading is sanitized too (no raw newline break-out).
  assert.match(out, /# TD-0001 · Innocent status: done priority: P0/);
});

test('buildTicketContent: titles with YAML-significant chars stay valid (quoted)', () => {
  // A colon-space or a `#` in an unquoted scalar would break or truncate the
  // frontmatter; quoting keeps the whole value intact.
  const colon = buildTicketContent('TD-0001', { title: 'Fix: the parser' }, DEFAULT_CONFIG);
  assert.match(colon, /title: "Fix: the parser"/);
  const hash = buildTicketContent('TD-0001', { title: 'foo # bar' }, DEFAULT_CONFIG);
  assert.match(hash, /title: "foo # bar"/);
  // An embedded quote is escaped, not left to terminate the scalar early.
  const quote = buildTicketContent('TD-0001', { title: 'say "hi"' }, DEFAULT_CONFIG);
  assert.match(quote, /title: "say \\"hi\\""/);
});
