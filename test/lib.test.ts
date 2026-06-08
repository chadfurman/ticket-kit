import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { parseFrontmatter, makeCompareTickets, type Ticket } from '../src/lib.ts';

const SAMPLE = `---
id: TD-0007
title: Do the thing
status: open
priority: P1
rank: 30
area: web
pillars: [low-stress, ownership]
blocked-by: [TD-0003]
created: 2026-06-08
---

# body
`;

test('parseFrontmatter: extracts fields and inline arrays', () => {
  const t = parseFrontmatter(SAMPLE, 'TD-0007-do-the-thing.md');
  assert.equal(t.id, 'TD-0007');
  assert.equal(t.title, 'Do the thing');
  assert.equal(t.status, 'open');
  assert.equal(t.rank, 30);
  assert.deepEqual(t.pillars, ['low-stress', 'ownership']);
  assert.deepEqual(t.blockedBy, ['TD-0003']);
});

test('parseFrontmatter: throws on missing required field', () => {
  const bad = '---\nid: TD-1\ntitle: x\n---\nbody';
  assert.throws(() => parseFrontmatter(bad, 'bad.md'), /missing required frontmatter field/);
});

test('parseFrontmatter: throws when frontmatter fence is absent', () => {
  assert.throws(() => parseFrontmatter('# no frontmatter', 'x.md'), /missing YAML frontmatter/);
});

function ticket(partial: Partial<Ticket>): Ticket {
  return {
    id: 'TD-0001',
    title: 't',
    status: 'open',
    priority: 'P2',
    rank: 100,
    area: 'a',
    pillars: [],
    blockedBy: [],
    created: '2026-06-08',
    filename: 'TD-0001-t.md',
    ...partial,
  };
}

test('makeCompareTickets: status column order, then priority, then rank', () => {
  const cmp = makeCompareTickets(DEFAULT_CONFIG);
  const open = ticket({ id: 'TD-0002', status: 'open', priority: 'P3', rank: 99 });
  const done = ticket({ id: 'TD-0001', status: 'done', priority: 'P0', rank: 1 });
  assert.ok(cmp(open, done) < 0, 'open sorts before done regardless of priority');

  const p0 = ticket({ id: 'TD-0003', status: 'open', priority: 'P0', rank: 50 });
  const p2 = ticket({ id: 'TD-0004', status: 'open', priority: 'P2', rank: 1 });
  assert.ok(cmp(p0, p2) < 0, 'within a column, P0 sorts before P2');
});

test('makeCompareTickets: unknown status/priority sort last', () => {
  const cmp = makeCompareTickets(DEFAULT_CONFIG);
  const known = ticket({ status: 'done', priority: 'P3' });
  const unknown = ticket({ status: 'mystery', priority: 'P9' });
  assert.ok(cmp(known, unknown) < 0);
});
