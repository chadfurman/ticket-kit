/**
 * `serve` — live-view HTTP server for the ticket board.
 *
 * Routes:
 *   GET /              — board shell; client polls /api/tickets every ~3s
 *   GET /api/tickets   — JSON, re-read fresh on every request (incl. icebox)
 *   GET /ticket/<id>   — the ticket .md rendered as a styled detail page
 *
 * No npm deps — Node built-ins only.
 */

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { type TicketKitConfig, ticketsDirPath } from './config.ts';
import {
  type Ticket,
  loadSorted,
  escapeHtml,
  priorityChipStyle,
  BOARD_CSS,
  BOARD_FILTER_SCRIPT,
  buildAreaFilterHtml,
  buildPriFilterHtml,
  buildColumnHtml,
} from './lib.ts';
import { renderMarkdown } from './markdown.ts';
import { DETAIL_CSS, buildDetailPage } from './detail.ts';

const ICEBOX_COLUMN = { key: 'icebox', label: 'Icebox' };

/** Live-board cards link to the rendered detail route, not the raw `.md`. */
const cardHrefRoute = (t: Ticket): string => `/ticket/${t.id}`;

function chipStyleMap(config: TicketKitConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of config.priorities) map[p] = priorityChipStyle(p);
  return map;
}

function buildLiveShell(tickets: Ticket[], config: TicketKitConfig): string {
  const allAreas = [...new Set(tickets.map((t) => t.area))].sort();
  const columns = [...config.columns, ICEBOX_COLUMN];
  const initialColumnHtml = buildColumnHtml(tickets, config, cardHrefRoute);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(config.title)} — Live</title>
<style>
${BOARD_CSS}
.board:not(.show-icebox) .column[data-status="icebox"] { display: none; }
.icebox-toggle { display: inline-flex; align-items: center; gap: 5px; color: var(--dim); font-size: 11px; cursor: pointer; }
.column[data-status="icebox"] { opacity: 0.85; }
</style>
</head>
<body>
<header>
  <h1>◈ ${escapeHtml(config.title)}</h1>
  <span class="header-note"><span class="live-dot">●</span>live — reflects ticket edits within ~3s</span>
</header>
<div class="filters">
  <input id="search" class="search-box" type="search" placeholder="search tickets…" autocomplete="off">
  <div class="filter-sep"></div>
  <span class="filter-label">Priority</span>
  ${buildPriFilterHtml(config)}
  <div class="filter-sep"></div>
  <span class="filter-label">Area</span>
  ${buildAreaFilterHtml(allAreas)}
  <div class="filter-sep"></div>
  <label class="icebox-toggle"><input type="checkbox" id="iceboxToggle"> show icebox</label>
</div>
<div class="board" id="board">
${initialColumnHtml}
</div>
<footer>Live view — polling <code>/api/tickets</code> every 3 s</footer>
<script>
${BOARD_FILTER_SCRIPT}

const COLUMNS = ${JSON.stringify(columns)};
const CHIP_STYLES = ${JSON.stringify(chipStyleMap(config))};

function escHtml(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function buildCardHtml(t) {
  const pillars = t.pillars.map((p) => \`<span class="tag">\${escHtml(p)}</span>\`).join('');
  const blocked = t.blockedBy.length > 0
    ? \`<div class="blocked">blocked-by: \${escHtml(t.blockedBy.join(', '))}</div>\`
    : '';
  return \`<a class="card" href="/ticket/\${escHtml(t.id)}" data-priority="\${escHtml(t.priority)}" data-area="\${escHtml(t.area)}">
  <div class="card-header">
    <span class="card-id">\${escHtml(t.id)}</span>
    <span class="chip" style="\${escHtml(CHIP_STYLES[t.priority] ?? '')}">\${escHtml(t.priority)}</span>
  </div>
  <div class="card-title">\${escHtml(t.title)}</div>
  <div class="card-area">\${escHtml(t.area)}</div>
  <div class="card-pillars">\${pillars}</div>
  \${blocked}
</a>\`;
}

function renderBoard(tickets) {
  const board = document.getElementById('board');
  if (!board) return;
  const scrollTop = board.scrollTop;
  for (const col of COLUMNS) {
    let colEl = board.querySelector(\`[data-status="\${col.key}"]\`);
    if (!colEl) {
      colEl = document.createElement('div');
      colEl.className = 'column';
      colEl.dataset.status = col.key;
      board.appendChild(colEl);
    }
    const colTickets = tickets.filter((t) => t.status === col.key);
    colEl.innerHTML = \`<div class="col-header">\${escHtml(col.label)} <span class="col-count">\${colTickets.length}</span></div>
  <div class="cards">\${colTickets.map(buildCardHtml).join('')}</div>\`;
  }
  board.scrollTop = scrollTop;
  stampDataAttrs(tickets);
  applyFilters();
}

const iceboxToggle = document.getElementById('iceboxToggle');
if (iceboxToggle) {
  iceboxToggle.addEventListener('change', (e) => {
    document.getElementById('board').classList.toggle('show-icebox', e.target.checked);
  });
}

async function poll() {
  try {
    const resp = await fetch('/api/tickets');
    if (resp.ok) renderBoard(await resp.json());
  } catch (_err) { /* network blip — retry next tick */ }
}
setInterval(() => { void poll(); }, 3000);
</script>
</body>
</html>
`;
}

function serveApiTickets(res: http.ServerResponse, dir: string, config: TicketKitConfig): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(loadSorted(dir, config)));
}

function serveRoot(res: http.ServerResponse, dir: string, config: TicketKitConfig): void {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(buildLiveShell(loadSorted(dir, config), config));
}

function serveTicketDetail(
  res: http.ServerResponse,
  dir: string,
  config: TicketKitConfig,
  id: string,
): void {
  const ticket = loadSorted(dir, config).find((t) => t.id === id);
  if (!ticket) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Ticket not found');
    return;
  }
  const markdown = fs.readFileSync(path.join(dir, ticket.filename), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(buildDetailPage(ticket, renderMarkdown(markdown), config, BOARD_CSS, DETAIL_CSS));
}

function makeRouter(dir: string, config: TicketKitConfig) {
  const detailRe = new RegExp(`^/ticket/(${config.idPrefix}-\\d{4})$`);
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = req.url ?? '/';
    if (url === '/api/tickets') {
      serveApiTickets(res, dir, config);
      return;
    }
    if (url === '/') {
      serveRoot(res, dir, config);
      return;
    }
    const detail = detailRe.exec(url);
    if (detail) {
      serveTicketDetail(res, dir, config, detail[1] ?? '');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  };
}

export function serve(rootDir: string, config: TicketKitConfig): http.Server {
  const dir = ticketsDirPath(rootDir, config);
  const server = http.createServer(makeRouter(dir, config));
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port.toString()} is already in use. Stop the existing server and retry.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(config.port, () => {
    console.log(`${config.title} → http://localhost:${config.port.toString()}`);
  });
  return server;
}
