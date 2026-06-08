/**
 * Shared ticket-kit logic: types, frontmatter parser, loader, sort comparator,
 * and the HTML-rendering helpers used by both `generate` (static build) and
 * `serve` (live-view server).
 *
 * Dependency-free — Node built-ins only. Statuses, priorities, columns, the id
 * prefix and the tickets directory all come from config, so the same code runs
 * in any project that drops in a `.tickets.json`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type TicketKitConfig,
  columnKeys,
  statusOrder,
  ticketFilePattern,
} from './config.ts';

// ---------------------------------------------------------------------------
// Types — status/priority are project-defined strings (validated by `check`)
// ---------------------------------------------------------------------------

export interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  rank: number;
  area: string;
  pillars: string[];
  blockedBy: string[];
  created: string;
  filename: string;
}

export const REQUIRED_FIELDS = [
  'id',
  'title',
  'status',
  'priority',
  'rank',
  'area',
  'pillars',
  'blocked-by',
  'created',
] as const;

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

function parseInlineArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (inner.length === 0) return [];
  return inner.split(',').map((s) => s.trim());
}

function extractFrontmatterBlock(content: string, filename: string): Record<string, string> {
  const fenceEnd = content.indexOf('---', 3);
  if (!content.startsWith('---') || fenceEnd === -1) {
    throw new Error(`${filename}: missing YAML frontmatter`);
  }

  const block = content.slice(3, fenceEnd).trim();
  const fields: Record<string, string> = {};

  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    fields[key] = line.slice(colon + 1).trim();
  }

  return fields;
}

function validateRequiredFields(fields: Record<string, string>, filename: string): void {
  for (const req of REQUIRED_FIELDS) {
    if (fields[req] === undefined) {
      throw new Error(`${filename}: missing required frontmatter field "${req}"`);
    }
  }
}

export function parseFrontmatter(content: string, filename: string): Ticket {
  const fields = extractFrontmatterBlock(content, filename);
  validateRequiredFields(fields, filename);

  return {
    id: fields['id'] ?? '',
    title: fields['title'] ?? '',
    status: fields['status'] ?? '',
    priority: fields['priority'] ?? '',
    rank: Number.parseInt(fields['rank'] ?? '0', 10),
    area: fields['area'] ?? '',
    pillars: parseInlineArray(fields['pillars'] ?? '[]'),
    blockedBy: parseInlineArray(fields['blocked-by'] ?? '[]'),
    created: fields['created'] ?? '',
    filename,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadTickets(ticketsDir: string, config: TicketKitConfig): Ticket[] {
  const pattern = ticketFilePattern(config);
  const files = fs
    .readdirSync(ticketsDir)
    .filter((f) => pattern.test(f))
    .sort();

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(ticketsDir, filename), 'utf8');
    return parseFrontmatter(content, filename);
  });
}

// ---------------------------------------------------------------------------
// Sort comparator (factory — closes over config's status/priority ordering)
// ---------------------------------------------------------------------------

export function makeCompareTickets(config: TicketKitConfig): (a: Ticket, b: Ticket) => number {
  const order = statusOrder(config);
  const pri = config.priorities;
  const rankOf = (arr: string[], v: string): number => {
    const i = arr.indexOf(v);
    return i === -1 ? arr.length : i; // unknown sorts last
  };
  return (a, b) => {
    const statusDiff = rankOf(order, a.status) - rankOf(order, b.status);
    if (statusDiff !== 0) return statusDiff;
    const priDiff = rankOf(pri, a.priority) - rankOf(pri, b.priority);
    if (priDiff !== 0) return priDiff;
    const rankDiff = a.rank - b.rank;
    if (rankDiff !== 0) return rankDiff;
    return a.id.localeCompare(b.id);
  };
}

export function loadSorted(ticketsDir: string, config: TicketKitConfig): Ticket[] {
  return [...loadTickets(ticketsDir, config)].sort(makeCompareTickets(config));
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

const DEFAULT_CHIP_STYLES: Record<string, string> = {
  P0: 'background:#c0392b;color:#fff',
  P1: 'background:#e67e22;color:#fff',
  P2: 'background:#2980b9;color:#fff',
  P3: 'background:#3d4a6e;color:#aeb9ee',
};

/** A deterministic fallback chip color for project-defined priorities. */
function fallbackChipStyle(priority: string): string {
  const palette = ['#c0392b', '#e67e22', '#2980b9', '#3d4a6e', '#6c3483', '#117864'];
  let hash = 0;
  for (const ch of priority) hash = (hash + ch.charCodeAt(0)) % palette.length;
  return `background:${palette[hash] ?? '#3d4a6e'};color:#fff`;
}

export function priorityChipStyle(priority: string): string {
  return DEFAULT_CHIP_STYLES[priority] ?? fallbackChipStyle(priority);
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Default card link: the raw `.md` file (used by the static board over file://). */
export function cardHrefFile(ticket: Ticket): string {
  return ticket.filename;
}

export function buildCard(ticket: Ticket, hrefFor: (t: Ticket) => string = cardHrefFile): string {
  const pillarsHtml = ticket.pillars
    .map((p) => `<span class="tag">${escapeHtml(p)}</span>`)
    .join('');
  const blockedHtml =
    ticket.blockedBy.length > 0
      ? `<div class="blocked">blocked-by: ${escapeHtml(ticket.blockedBy.join(', '))}</div>`
      : '';

  return `<a class="card" href="${escapeHtml(hrefFor(ticket))}">
  <div class="card-header">
    <span class="card-id">${escapeHtml(ticket.id)}</span>
    <span class="chip" style="${priorityChipStyle(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
  </div>
  <div class="card-title">${escapeHtml(ticket.title)}</div>
  <div class="card-area">${escapeHtml(ticket.area)}</div>
  <div class="card-pillars">${pillarsHtml}</div>
  ${blockedHtml}
</a>`;
}

export function buildColumnHtml(
  tickets: Ticket[],
  config: TicketKitConfig,
  hrefFor: (t: Ticket) => string = cardHrefFile,
): string {
  return config.columns
    .map(({ key, label }) => {
      const colTickets = tickets.filter((t) => t.status === key);
      const cardsHtml = colTickets.map((t) => buildCard(t, hrefFor)).join('\n');
      return `<div class="column" data-status="${escapeHtml(key)}">
  <div class="col-header">${escapeHtml(label)} <span class="col-count">${colTickets.length.toString()}</span></div>
  <div class="cards">${cardsHtml}</div>
</div>`;
    })
    .join('\n');
}

export function buildAreaFilterHtml(allAreas: string[]): string {
  return allAreas
    .map(
      (a) =>
        `<button class="filter-chip" data-filter="area" data-value="${escapeHtml(a)}">${escapeHtml(a)}</button>`,
    )
    .join('');
}

export function buildPriFilterHtml(config: TicketKitConfig): string {
  return config.priorities
    .map(
      (p) =>
        `<button class="filter-chip" data-filter="priority" data-value="${escapeHtml(p)}">${escapeHtml(p)}</button>`,
    )
    .join('');
}

/** Kanban tickets = everything not iced. */
export function boardTickets(tickets: Ticket[], config: TicketKitConfig): Ticket[] {
  const keys = new Set(columnKeys(config));
  return tickets.filter((t) => keys.has(t.status));
}

// ---------------------------------------------------------------------------
// Shared CSS + client filter/search script (injected into static + live board)
// ---------------------------------------------------------------------------

export const BOARD_CSS = `
:root {
  --bg: #05060f;
  --panel: #0b1024;
  --col-bg: #0d1330;
  --ink: #cdd6ff;
  --dim: #5a6699;
  --border: #1c2550;
  --accent: #7aa2ff;
  --card-bg: #0b1228;
  --card-hover: #111b3a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: radial-gradient(1200px 800px at 50% -10%, #0a1030, #05060f 70%);
  color: var(--ink);
  font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace;
  min-height: 100vh;
}
header {
  padding: 18px 22px 10px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}
h1 {
  font-size: 17px;
  letter-spacing: 0.5px;
  color: #fff;
  text-shadow: 0 0 12px rgba(120,160,255,0.6);
}
.header-note { color: var(--dim); font-size: 11px; }
.live-dot { color: #4ade80; margin-right: 4px; }
.filters {
  padding: 10px 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid var(--border);
}
.filter-label {
  color: var(--dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-right: 4px;
}
.filter-chip {
  background: var(--panel);
  color: var(--dim);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 9px;
  font: inherit;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.filter-chip:hover { border-color: var(--accent); color: var(--ink); }
.filter-chip.active { background: var(--accent); color: #05060f; border-color: var(--accent); }
.filter-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
.search-box {
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  min-width: 180px;
}
.search-box:focus { outline: none; border-color: var(--accent); }
.board {
  display: flex;
  gap: 16px;
  padding: 18px 22px;
  overflow-x: auto;
  align-items: flex-start;
}
.column {
  flex: 0 0 300px;
  background: var(--col-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.col-header {
  padding: 10px 14px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.col-count {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  color: var(--dim);
}
.cards { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.card {
  display: block;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 11px 13px;
  text-decoration: none;
  color: var(--ink);
  transition: all 0.15s;
}
.card:hover { background: var(--card-hover); border-color: #2a3870; }
.card.hidden { display: none; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-id { color: var(--dim); font-size: 11px; }
.chip { border-radius: 4px; padding: 1px 7px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
.card-title { font-size: 12px; color: #fff; margin-bottom: 5px; line-height: 1.4; }
.card-area { font-size: 10px; color: var(--dim); margin-bottom: 6px; }
.card-pillars { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  background: #111b3a;
  color: #7aa2ff;
  border: 1px solid #1c2d5e;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
}
.blocked { font-size: 10px; color: #e67e22; margin-top: 5px; }
.icebox-note { padding: 10px 22px 20px; color: var(--dim); font-size: 11px; }
footer {
  padding: 14px 22px 40px;
  color: var(--dim);
  font-size: 11px;
  border-top: 1px solid var(--border);
  margin-top: 20px;
}
`.trim();

export const BOARD_FILTER_SCRIPT = `
const chips = document.querySelectorAll('.filter-chip');
const active = { priority: null, area: null };
const searchEl = document.getElementById('search');
let searchTerm = '';

function applyFilters() {
  const cards = document.querySelectorAll('.card');
  for (const card of cards) {
    const priOk = !active.priority || card.dataset.priority === active.priority;
    const areaOk = !active.area || card.dataset.area === active.area;
    const text = (card.textContent || '').toLowerCase();
    const searchOk = !searchTerm || text.includes(searchTerm);
    card.classList.toggle('hidden', !(priOk && areaOk && searchOk));
  }
}

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    const value = chip.dataset.value;
    if (active[filter] === value) {
      active[filter] = null;
      chip.classList.remove('active');
    } else {
      document.querySelectorAll(\`.filter-chip[data-filter="\${filter}"]\`).forEach((c) => c.classList.remove('active'));
      active[filter] = value;
      chip.classList.add('active');
    }
    applyFilters();
  });
});

if (searchEl) {
  searchEl.addEventListener('input', (e) => {
    searchTerm = (e.target.value || '').toLowerCase();
    applyFilters();
  });
}

function stampDataAttrs(TICKETS) {
  document.querySelectorAll('.card').forEach((card) => {
    const id = card.querySelector('.card-id')?.textContent?.trim();
    const ticket = TICKETS.find((t) => t.id === id);
    if (ticket) {
      card.dataset.priority = ticket.priority;
      card.dataset.area = ticket.area;
    }
  });
}
`.trim();
