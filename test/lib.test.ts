import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { parseFrontmatter, makeCompareTickets, buildColumnHtml, isDoneStatus, type Ticket } from '../src/lib.ts';
import { buildDetailPage } from '../src/detail.ts';

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

test('parseFrontmatter: parent is undefined when the optional field is absent', () => {
  const t = parseFrontmatter(SAMPLE, 'TD-0007-do-the-thing.md');
  assert.equal(t.parent, undefined);
});

test('parseFrontmatter: extracts parent when present', () => {
  const withParent = SAMPLE.replace('created: 2026-06-08', 'parent: TD-0003\ncreated: 2026-06-08');
  const t = parseFrontmatter(withParent, 'TD-0007-do-the-thing.md');
  assert.equal(t.parent, 'TD-0003');
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

test('buildColumnHtml: nests children under their parent with a done/total badge', () => {
  const parent = ticket({ id: 'TD-0001', status: 'in-progress', title: 'parent task' });
  const child1 = ticket({ id: 'TD-0002', status: 'done', parent: 'TD-0001', title: 'kid one' });
  const child2 = ticket({ id: 'TD-0003', status: 'open', parent: 'TD-0001', title: 'kid two' });
  const html = buildColumnHtml([parent, child1, child2], DEFAULT_CONFIG);

  // parent shows a 1/2 badge (one of two children is in the done column)
  assert.match(html, /subtask-badge[^>]*>1\/2</);
  // both children render as nested subtask rows
  assert.match(html, /class="subtask\b[^"]*"[\s\S]*?TD-0002/);
  assert.match(html, /TD-0003/);
  // children are pulled OUT of their own column's top-level list:
  // the Open column has zero top-level cards (child2 is nested, not loose)
  assert.match(html, /Open <span class="col-count">0</);
});

test('buildColumnHtml: a child whose parent is absent still renders as a normal card', () => {
  const orphan = ticket({ id: 'TD-0009', status: 'open', parent: 'TD-9999', title: 'orphan' });
  const html = buildColumnHtml([orphan], DEFAULT_CONFIG);
  assert.match(html, /Open <span class="col-count">1</);
  assert.match(html, /TD-0009/);
});

test('isDoneStatus: true only for the last (rightmost) column', () => {
  assert.equal(isDoneStatus('done', DEFAULT_CONFIG), true);
  assert.equal(isDoneStatus('open', DEFAULT_CONFIG), false);
  assert.equal(isDoneStatus('in-progress', DEFAULT_CONFIG), false);
  const cfg = { ...DEFAULT_CONFIG, columns: [{ key: 'todo', label: 'Todo' }, { key: 'shipped', label: 'Shipped' }] };
  assert.equal(isDoneStatus('shipped', cfg), true);
  assert.equal(isDoneStatus('done', cfg), false); // 'done' isn't the last column here
});

test('buildColumnHtml: badge counts done children — 0/2 and 2/2', () => {
  const parent = ticket({ id: 'TD-0001', status: 'in-progress' });
  const openKids = [
    ticket({ id: 'TD-0002', status: 'open', parent: 'TD-0001' }),
    ticket({ id: 'TD-0003', status: 'open', parent: 'TD-0001' }),
  ];
  assert.match(buildColumnHtml([parent, ...openKids], DEFAULT_CONFIG), /subtask-badge[^>]*>0\/2</);
  const doneKids = openKids.map((k) => ({ ...k, status: 'done' }));
  assert.match(buildColumnHtml([parent, ...doneKids], DEFAULT_CONFIG), /subtask-badge[^>]*>2\/2</);
});

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const asCard = (id: string): RegExp => new RegExp(`class="card-id">${id}<`, 'g');
const asSubtask = (id: string): RegExp => new RegExp(`class="st-id">${id}<`, 'g');

test('buildColumnHtml: a grandchild degrades to a loose card — rendered exactly once', () => {
  const a = ticket({ id: 'TD-0001', status: 'in-progress', title: 'A' });
  const b = ticket({ id: 'TD-0002', status: 'open', parent: 'TD-0001', title: 'B' });
  const c = ticket({ id: 'TD-0003', status: 'open', parent: 'TD-0002', title: 'C' });
  const html = buildColumnHtml([a, b, c], DEFAULT_CONFIG);
  // A loose card; B nested under A (not loose); C loose (its parent B is itself nested)
  assert.equal(count(html, asCard('TD-0001')), 1);
  assert.equal(count(html, asCard('TD-0002')) + count(html, asSubtask('TD-0002')), 1); // B exactly once
  assert.equal(count(html, asSubtask('TD-0002')), 1); // …as a nested row
  assert.equal(count(html, asCard('TD-0003')), 1);
  assert.match(html, /In Progress <span class="col-count">1</); // only A is loose here, not B
  assert.match(html, /Open <span class="col-count">1</); // only C is loose here
});

test('buildColumnHtml: a parent cycle degrades both to loose cards — each exactly once', () => {
  const x = ticket({ id: 'TD-0001', status: 'open', parent: 'TD-0002', title: 'X' });
  const y = ticket({ id: 'TD-0002', status: 'open', parent: 'TD-0001', title: 'Y' });
  const html = buildColumnHtml([x, y], DEFAULT_CONFIG);
  assert.match(html, /Open <span class="col-count">2</);
  for (const id of ['TD-0001', 'TD-0002']) {
    assert.equal(count(html, asCard(id)), 1); // loose card once
    assert.equal(count(html, asSubtask(id)), 0); // never also a nested row (no double-render)
  }
});

test('buildColumnHtml: a self-parent renders exactly once, never nested under itself', () => {
  const a = ticket({ id: 'TD-0001', status: 'open', parent: 'TD-0001', title: 'A' });
  const html = buildColumnHtml([a], DEFAULT_CONFIG);
  assert.equal(count(html, asCard('TD-0001')), 1);
  assert.equal(count(html, asSubtask('TD-0001')), 0);
});

test('buildDetailPage: renders the parent link and the subtask list', () => {
  const parent = ticket({ id: 'TD-0001', title: 'the parent' });
  const doneChild = ticket({ id: 'TD-0002', title: 'the child', status: 'done' });
  const subject = ticket({ id: 'TD-0003', title: 'subject', parent: 'TD-0001' });
  const html = buildDetailPage(subject, '<p>body</p>', DEFAULT_CONFIG, '', '', {
    parent,
    children: [doneChild],
  });
  assert.match(html, /parent:[\s\S]*TD-0001/);
  assert.match(html, /href="\/ticket\/TD-0001"/); // parent link points at the detail route
  assert.match(html, /subtasks:/);
  assert.match(html, /<li class="done"[\s\S]*TD-0002/);
});
