/**
 * Minimal, dependency-free Markdown → HTML renderer, scoped to the subset our
 * ticket files use: frontmatter strip, ATX headings, GFM tables, ordered /
 * unordered lists with `[ ]`/`[x]` checkboxes, horizontal rules, paragraphs,
 * and inline bold / code / links.
 *
 * It is intentionally small — not a CommonMark implementation. It only has to
 * render the tickets we author, which follow a predictable shape.
 */

import { escapeHtml } from './lib.ts';

const PLACEHOLDER = '\0';

/**
 * Allow only links we can be sure won't execute script when clicked.
 * Permits http(s), mailto, anchors, and relative paths; rejects javascript:,
 * data:, vbscript:, and anything else carrying a scheme. A rejected URL renders
 * as `#`, preserving the link text while neutralizing the payload.
 *
 * The URL arrives already HTML-escaped (renderInline escapes before linkifying),
 * so decode the few entities that could hide a scheme's `:` before testing.
 *
 * Browsers strip ASCII tab/newline/CR from anywhere in a URL and trim leading
 * C0 controls/spaces before resolving it, so a scheme broken up by a control
 * char (`java<TAB>script:`) or hidden behind a leading one (`\x01javascript:`)
 * would slip past a naive scheme check yet still execute. Strip the same set
 * before testing — `.trim()` alone leaves embedded chars and C0 controls below
 * `\x09`. The original (untouched) URL is still what we return when it's safe.
 */
function safeUrl(escapedUrl: string): string {
  const decoded = escapedUrl
    .replace(/&amp;/g, '&')
    .replace(/&#0*58;?/g, ':')
    .replace(/&#x0*3a;?/gi, ':')
    .replace(/&colon;/gi, ':')
    .replace(/[\x00-\x20\x7f]+/g, '');
  // No scheme (relative path / anchor / query) → safe.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return escapedUrl;
  // Has a scheme → allow only a known-safe set.
  if (/^(?:https?|mailto):/i.test(decoded)) return escapedUrl;
  return '#';
}

/** Render inline spans: code (extracted first), then bold and links. */
export function renderInline(text: string): string {
  const codes: string[] = [];
  const stashed = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `${PLACEHOLDER}${(codes.length - 1).toString()}${PLACEHOLDER}`;
  });
  const escaped = escapeHtml(stashed)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, label: string, url: string) => `<a href="${safeUrl(url)}">${label}</a>`,
    );
  return escaped.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'),
    (_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? '')}</code>`,
  );
}

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  const after = md.indexOf('\n', end + 1);
  return after === -1 ? '' : md.slice(after + 1);
}

const isHeading = (l: string): boolean => /^#{1,6}\s+/.test(l);
const isHr = (l: string): boolean => /^-{3,}$/.test(l.trim());
const isTableSep = (l: string): boolean => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');
const isListItem = (l: string): boolean => /^\s*([-*]|\d+\.)\s+/.test(l);

function renderHeading(line: string): string {
  const match = /^(#{1,6})\s+(.*)$/.exec(line);
  if (!match) return '';
  const level = (match[1] ?? '').length;
  return `<h${level.toString()}>${renderInline(match[2] ?? '')}</h${level.toString()}>`;
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

function consumeTable(lines: string[], start: number): [string, number] {
  const header = splitRow(lines[start] ?? '');
  let i = start + 2; // skip header + separator
  const rows: string[] = [];
  while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim() !== '') {
    rows.push(
      `<tr>${splitRow(lines[i] ?? '')
        .map((c) => `<td>${renderInline(c)}</td>`)
        .join('')}</tr>`,
    );
    i++;
  }
  const head = `<tr>${header.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr>`;
  return [`<table><thead>${head}</thead><tbody>${rows.join('')}</tbody></table>`, i];
}

function renderListItem(line: string): string {
  const text = line.replace(/^\s*([-*]|\d+\.)\s+/, '');
  const task = /^\[([ xX])\]\s+/.exec(text);
  if (!task) return `<li>${renderInline(text)}</li>`;
  const box = task[1] === ' ' ? '☐' : '☑';
  return `<li class="task">${box} ${renderInline(text.slice(task[0].length))}</li>`;
}

function isListContinuation(line: string): boolean {
  return line.trim() !== '' && !isHeading(line) && !isHr(line) && !isListItem(line);
}

function consumeList(lines: string[], start: number): [string, number] {
  const ordered = /^\s*\d+\.\s+/.test(lines[start] ?? '');
  let i = start;
  const items: string[] = []; // raw text per item, soft-wraps folded in
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (isListItem(line)) {
      items.push(line);
    } else if (items.length > 0 && isListContinuation(line)) {
      items[items.length - 1] = `${items[items.length - 1] ?? ''} ${line.trim()}`;
    } else {
      break;
    }
    i++;
  }
  const tag = ordered ? 'ol' : 'ul';
  return [`<${tag}>${items.map(renderListItem).join('')}</${tag}>`, i];
}

function consumeParagraph(lines: string[], start: number): [string, number] {
  let i = start;
  const parts: string[] = [];
  while (
    i < lines.length &&
    (lines[i] ?? '').trim() !== '' &&
    !isHeading(lines[i] ?? '') &&
    !isListItem(lines[i] ?? '') &&
    !isHr(lines[i] ?? '')
  ) {
    parts.push((lines[i] ?? '').trim());
    i++;
  }
  return [`<p>${renderInline(parts.join(' '))}</p>`, i];
}

export function renderMarkdown(md: string): string {
  const lines = stripFrontmatter(md).split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
    } else if (isHeading(line)) {
      out.push(renderHeading(line));
      i++;
    } else if (isHr(line)) {
      out.push('<hr>');
      i++;
    } else if (line.includes('|') && isTableSep(lines[i + 1] ?? '')) {
      const [html, next] = consumeTable(lines, i);
      out.push(html);
      i = next;
    } else if (isListItem(line)) {
      const [html, next] = consumeList(lines, i);
      out.push(html);
      i = next;
    } else {
      const [html, next] = consumeParagraph(lines, i);
      out.push(html);
      i = next;
    }
  }
  return out.join('\n');
}
