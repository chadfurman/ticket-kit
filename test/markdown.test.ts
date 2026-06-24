import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderInline, renderMarkdown } from '../src/markdown.ts';

test('renderInline: bold, code, and links', () => {
  assert.equal(renderInline('a **bold** word'), 'a <strong>bold</strong> word');
  assert.equal(renderInline('use `npm i`'), 'use <code>npm i</code>');
  assert.equal(renderInline('[site](https://x.com)'), '<a href="https://x.com">site</a>');
});

test('renderInline: code is not further processed and is escaped', () => {
  assert.equal(renderInline('`<a>**x**`'), '<code>&lt;a&gt;**x**</code>');
});

test('renderInline: dangerous link schemes are neutralized (no XSS)', () => {
  // javascript: / data: / vbscript: must not survive into the href.
  // The dangerous scheme is neutralized to href="#" — the link can never
  // execute. (A nested ")" ends the link early per the minimal regex, leaving
  // inert escaped text after it; the security property is that no payload
  // reaches the href.)
  assert.match(renderInline('[x](javascript:alert(1))'), /^<a href="#">x<\/a>/);
  assert.match(
    renderInline('[x](data:text/html,<img src=x onerror=alert(1)>)'),
    /^<a href="#">x<\/a>/,
  );
  assert.match(renderInline('[x](vbscript:msgbox 1)'), /^<a href="#">x<\/a>$/);
  // Entity-encoded colons (decimal, hex, and named) must not sneak a scheme past.
  assert.match(renderInline('[x](javascript&#58;alert 1)'), /^<a href="#">x<\/a>$/);
  assert.match(renderInline('[x](javascript&#x3a;alert 1)'), /^<a href="#">x<\/a>$/);
  assert.match(renderInline('[x](javascript&#X3A;alert 1)'), /^<a href="#">x<\/a>$/);
  assert.match(renderInline('[x](javascript&colon;alert 1)'), /^<a href="#">x<\/a>$/);
  // None of these leave the dangerous scheme anywhere in the href.
  assert.doesNotMatch(renderInline('[x](javascript:alert(1))'), /href="[^"]*javascript/i);
});

test('renderInline: control chars cannot smuggle a scheme past the check', () => {
  // Browsers strip ASCII whitespace/control chars from a URL before resolving
  // it, so a scheme broken up by — or prefixed with — a control char still
  // executes once the browser normalizes it. The check must strip the same
  // chars before testing, not rely on `.trim()` (which leaves C0 controls).
  // Tab embedded inside the scheme: `java<TAB>script:` → javascript: in a browser.
  assert.match(renderInline('[x](java\tscript:alert(1))'), /^<a href="#">x<\/a>/);
  // Leading control char before the scheme (invisible; survives `.trim()`).
  assert.match(renderInline('[x](\x01javascript:alert(1))'), /^<a href="#">x<\/a>/);
  // Newline-broken scheme, and an embedded NUL.
  assert.match(renderInline('[x](java\nscript:alert(1))'), /^<a href="#">x<\/a>/);
  assert.match(renderInline('[x](\x00javascript:alert(1))'), /^<a href="#">x<\/a>/);
  // No "javascript" scheme reaches any href, in any of these.
  assert.doesNotMatch(renderInline('[x](java\tscript:alert(1))'), /href="[^"]*java/i);
  assert.doesNotMatch(renderInline('[x](\x01javascript:alert(1))'), /href="[^"]*java/i);
});

test('renderInline: safe links still render', () => {
  assert.equal(renderInline('[a](https://x.com)'), '<a href="https://x.com">a</a>');
  assert.equal(renderInline('[a](http://x.com)'), '<a href="http://x.com">a</a>');
  assert.equal(renderInline('[a](mailto:x@y.com)'), '<a href="mailto:x@y.com">a</a>');
  assert.equal(renderInline('[a](/tickets/TD-0001)'), '<a href="/tickets/TD-0001">a</a>');
  assert.equal(renderInline('[a](#section)'), '<a href="#section">a</a>');
});

test('renderMarkdown: strips frontmatter', () => {
  const md = '---\nid: TD-0001\n---\n\n# Title\n';
  assert.match(renderMarkdown(md), /<h1>Title<\/h1>/);
  assert.doesNotMatch(renderMarkdown(md), /id: TD-0001/);
});

test('renderMarkdown: GFM table', () => {
  const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
  const html = renderMarkdown(md);
  assert.match(html, /<table>/);
  assert.match(html, /<th>A<\/th>/);
  assert.match(html, /<td>1<\/td>/);
});

test('renderMarkdown: checkbox list', () => {
  const md = '- [ ] todo\n- [x] done';
  const html = renderMarkdown(md);
  assert.match(html, /li class="task">☐ todo/);
  assert.match(html, /li class="task">☑ done/);
});

test('renderMarkdown: folds soft-wrapped list items so bold does not split', () => {
  const md = '1. **proxy OFF\n   (grey cloud)** — note';
  const html = renderMarkdown(md);
  assert.match(html, /<strong>proxy OFF \(grey cloud\)<\/strong>/);
  assert.doesNotMatch(html, /\*\*/);
});
