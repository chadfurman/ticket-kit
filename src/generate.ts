/**
 * `generate` — regenerate the ticket index inside `<ticketsDir>/README.md`
 * (between the TICKETS markers) and write a self-contained static kanban board
 * at `<ticketsDir>/board.html`.
 *
 * Idempotent: running twice produces identical output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type TicketKitConfig, ticketsDirPath } from './config.ts';
import {
  type Ticket,
  loadSorted,
  boardTickets,
  buildColumnHtml,
  buildAreaFilterHtml,
  buildPriFilterHtml,
  BOARD_CSS,
  BOARD_FILTER_SCRIPT,
} from './lib.ts';

const START_MARKER = '<!-- TICKETS:START -->';
const END_MARKER = '<!-- TICKETS:END -->';

function buildIndexTable(tickets: Ticket[], config: TicketKitConfig): string {
  const rows = boardTickets(tickets, config).map(
    (t) =>
      `| [${t.id}](${t.filename}) | ${t.title} | ${t.status} | ${t.priority} | ${t.rank.toString()} | ${t.area} |`,
  );
  return [
    START_MARKER,
    '| ID | Title | Status | Pri | Rank | Area |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    END_MARKER,
  ].join('\n');
}

function defaultReadme(config: TicketKitConfig): string {
  return `# ${config.title}

Tickets are markdown files with YAML frontmatter. The table below is generated —
do not edit between the markers. Run \`ticket-kit generate\` after adding tickets,
or \`ticket-kit serve\` for a live board.

## Index

${START_MARKER}
${END_MARKER}

## Icebox

Iced tickets (status \`icebox\`) are not shown on the board. Promote one by
changing its status to a board column when it's next.
`;
}

function regenerateReadme(readmePath: string, tickets: Ticket[], config: TicketKitConfig): void {
  const existing = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, 'utf8')
    : defaultReadme(config);
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`${readmePath}: missing ${START_MARKER} / ${END_MARKER} markers`);
  }
  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + END_MARKER.length);
  fs.writeFileSync(readmePath, before + buildIndexTable(tickets, config) + after, 'utf8');
}

export function buildBoardHtml(tickets: Ticket[], config: TicketKitConfig): string {
  const kanban = boardTickets(tickets, config);
  const allAreas = [...new Set(kanban.map((t) => t.area))].sort();
  const ticketJson = JSON.stringify(
    kanban.map((t) => ({ id: t.id, priority: t.priority, area: t.area })),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${config.title} — Board</title>
<style>
${BOARD_CSS}
</style>
</head>
<body>
<header>
  <h1>◈ ${config.title}</h1>
  <span class="header-note">static snapshot — regenerate with <code>ticket-kit generate</code></span>
</header>
<div class="filters">
  <input id="search" class="search-box" type="search" placeholder="search tickets…" autocomplete="off">
  <div class="filter-sep"></div>
  <span class="filter-label">Priority</span>
  ${buildPriFilterHtml(config)}
  <div class="filter-sep"></div>
  <span class="filter-label">Area</span>
  ${buildAreaFilterHtml(allAreas)}
</div>
<div class="board">
${buildColumnHtml(kanban, config)}
</div>
<footer>Generated from ${config.ticketsDir}/*.md frontmatter · open via file://</footer>
<script>
const TICKETS = ${ticketJson};
${BOARD_FILTER_SCRIPT}
stampDataAttrs(TICKETS);
</script>
</body>
</html>
`;
}

export function generate(rootDir: string, config: TicketKitConfig): { count: number } {
  const dir = ticketsDirPath(rootDir, config);
  const tickets = loadSorted(dir, config);
  regenerateReadme(path.join(dir, 'README.md'), tickets, config);
  fs.writeFileSync(path.join(dir, 'board.html'), buildBoardHtml(tickets, config), 'utf8');
  return { count: tickets.length };
}
