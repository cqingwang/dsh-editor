import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Editor tab close controls are larger and expose a rounded focus state', () => {
  const style = source.slice(
    source.indexOf('      tabClose: {'),
    source.indexOf('      statusButton:', source.indexOf('      tabClose: {')),
  );
  assert.match(style, /width: 20/u);
  assert.match(style, /height: 20/u);
  assert.match(style, /borderRadius: 5/u);
  assert.match(style, /display: 'inline-flex'/u);
  assert.match(source, /\.dsh-editor-tab-close:focus-visible \{/u);
  assert.match(source, /\.dsh-editor-tab-close:focus-visible \{ background: var\(--dsw-alias-interactive-bg-hover-solid\) !important;/u);
  assert.match(source, /border-radius: 5px;/u);
  assert.ok((source.match(/className: 'dsh-editor-tab-close'/gu) ?? []).length >= 3);
});

test('A newly opened file becomes the first open tab and menu entry', () => {
  assert.match(
    source,
    /current\.some\(\(entry\) => entry\.path === path\) \? current : \[file, \.\.\.current\]/u,
  );
  assert.doesNotMatch(
    source,
    /current\.some\(\(entry\) => entry\.path === path\) \? current : \[\.\.\.current, file\]/u,
  );
});
