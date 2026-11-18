import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

function searchEverywhere() {
  const start = source.indexOf('function SearchEverywhere(');
  const end = source.indexOf('function FindToolWindowView(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Search Everywhere moves header actions into CompactActionBar', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /React\.createElement\(CompactActionBar/);
  assert.match(dialog, /ariaLabel: t\('editor\.searchEverywhere'\)/);
  assert.match(dialog, /data-dsh-search-open-find-tool-window/);
});

test('Search Everywhere action order and pinned controls match IDEA priority', () => {
  const dialog = searchEverywhere();
  for (const id of ['include', 'case', 'words', 'regex', 'preview', 'filter', 'openFind']) {
    assert.match(dialog, new RegExp(`id: '${id}'`));
  }
  assert.match(dialog, /id: 'filter'[\s\S]*?pinned: true/);
  assert.match(dialog, /id: 'openFind'[\s\S]*?pinned: true/);
});

test('Filter opens from either the direct button or overflow fallback', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /event\?\.currentTarget\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(dialog, /searchInputRef\.current\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(dialog, /setFilterMenu\(\(current\) =>\s+current === null/u);
});

test('Open Find is disabled only for an empty query', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /disabled: effectiveQuery === '',/);
});
