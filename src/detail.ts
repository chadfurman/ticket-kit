/**
 * The single-ticket detail page: the ticket's markdown body rendered as a
 * styled HTML page, with a meta strip (id, priority, status, area, pillars)
 * and a back link to the board.
 */

import type { TicketKitConfig } from './config.ts';
import { type Ticket, escapeHtml, priorityChipStyle } from './lib.ts';

export const DETAIL_CSS = `
.detail { max-width: 820px; margin: 0 auto; padding: 28px 24px 60px; }
.back { color: var(--accent); text-decoration: none; font-size: 12px; }
.back:hover { text-decoration: underline; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 18px 0 6px; }
.detail-meta .chip { border-radius: 4px; padding: 2px 9px; font-size: 11px; font-weight: 600; }
.detail-meta .meta-tag {
  background: #111b3a; color: #7aa2ff; border: 1px solid #1c2d5e;
  border-radius: 3px; padding: 2px 8px; font-size: 11px;
}
.prose { margin-top: 16px; }
.prose h1 { font-size: 20px; color: #fff; margin: 22px 0 10px; text-shadow: 0 0 12px rgba(120,160,255,0.4); }
.prose h2 { font-size: 15px; color: var(--accent); margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
.prose h3 { font-size: 13px; color: var(--ink); margin: 18px 0 6px; }
.prose p { margin: 10px 0; color: var(--ink); }
.prose ul, .prose ol { margin: 10px 0 10px 22px; }
.prose li { margin: 4px 0; }
.prose li.task { list-style: none; margin-left: -18px; }
.prose code { background: #0b1228; border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-size: 12px; color: #9fd0ff; }
.prose strong { color: #fff; }
.prose a { color: var(--accent); }
.prose hr { border: none; border-top: 1px solid var(--border); margin: 22px 0; }
.prose table { border-collapse: collapse; margin: 14px 0; width: 100%; font-size: 12px; }
.prose th, .prose td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
.prose th { background: var(--col-bg); color: var(--accent); }
`.trim();

export function buildDetailPage(
  ticket: Ticket,
  prose: string,
  config: TicketKitConfig,
  boardCss: string,
  detailCss: string,
): string {
  const pillars = ticket.pillars
    .map((p) => `<span class="meta-tag">${escapeHtml(p)}</span>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ticket.id)} — ${escapeHtml(ticket.title)}</title>
<style>
${boardCss}
${detailCss}
</style>
</head>
<body>
<div class="detail">
  <a class="back" href="/">← ${escapeHtml(config.title)}</a>
  <div class="detail-meta">
    <span class="card-id">${escapeHtml(ticket.id)}</span>
    <span class="chip" style="${priorityChipStyle(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
    <span class="meta-tag">${escapeHtml(ticket.status)}</span>
    <span class="meta-tag">${escapeHtml(ticket.area)}</span>
    ${pillars}
  </div>
  <div class="prose">
${prose}
  </div>
</div>
</body>
</html>
`;
}
