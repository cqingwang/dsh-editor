import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

function searchEverywhere() {
  const start = source.indexOf('function SearchEverywhere(');
  const end = source.indexOf('function FindToolWindowView(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Search Everywhere exposes roving tab semantics and tab keyboard navigation', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /ref: searchTabListRef/);
  assert.match(dialog, /tabIndex: effectiveTab === tab\.id \? 0 : -1/);
  assert.match(dialog, /'data-dsh-search-tab-id': tab\.id/);
  assert.match(dialog, /onKeyDown: \(event\) => handleSearchTabKeyDown\(event\)/);
  assert.match(dialog, /const handleSearchTabKeyDown =/);
  assert.match(dialog, /searchEverywhereTabTarget\(tabs, effectiveTab, event\.key\)/);
});

test('Search Everywhere tab target wraps and supports boundary keys', () => {
  const target = extract('searchEverywhereTabTarget');
  const tabs = [{ id: 'all' }, { id: 'files' }, { id: 'text' }, { id: 'actions' }];
  assert.equal(target(tabs, 'all', 'ArrowLeft'), 'actions');
  assert.equal(target(tabs, 'actions', 'ArrowRight'), 'all');
  assert.equal(target(tabs, 'files', 'ArrowRight'), 'text');
  assert.equal(target(tabs, 'text', 'ArrowLeft'), 'files');
  assert.equal(target(tabs, 'text', 'Home'), 'all');
  assert.equal(target(tabs, 'files', 'End'), 'actions');
  assert.equal(target(tabs, 'files', 'Enter'), 'files');
  assert.equal(target([], 'all', 'ArrowRight'), null);
});

test('Search Everywhere connects its combobox, listbox and active option', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /const SEARCH_EVERYWHERE_LISTBOX_ID = 'dsh-editor-search-everywhere-listbox'/);
  assert.match(dialog, /role: 'combobox'/);
  assert.match(dialog, /'aria-autocomplete': 'list'/);
  assert.match(dialog, /'aria-controls': SEARCH_EVERYWHERE_LISTBOX_ID/);
  assert.match(dialog, /id: SEARCH_EVERYWHERE_LISTBOX_ID/);
  assert.match(dialog, /tabIndex: 0/);
  assert.match(dialog, /'aria-activedescendant': activeResult === null \? undefined : searchEverywhereOptionId\(activeResult\.rowKey\)/);
  assert.match(dialog, /id: searchEverywhereOptionId\(result\.rowKey\)/);
  assert.match(dialog, /onKeyDown: handleSearchResultKeyDown/);
});

test('Search Everywhere option ids are stable and collision-safe', () => {
  const optionId = extract('searchEverywhereOptionId');
  assert.equal(optionId('file:src/app.ts'), optionId('file:src/app.ts'));
  assert.notEqual(optionId('file:src/a/b.ts'), optionId('file:src/a-b.ts'));
  assert.match(optionId('text:docs/a b.md:1:2'), /^dsh-editor-search-option-[A-Za-z0-9%._~()'!*;-]+$/);
});

test('the Search Everywhere result list reuses result navigation and context menu logic', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /const handleSearchResultKeyDown = \(event\) =>/);
  assert.match(dialog, /openResultMenuAt\(rect\?\.left \?\? 20, rect\?\.bottom \?\? 20, activeResult\)/);
  assert.match(dialog, /moveSearchSelection\(1\)/);
  assert.match(dialog, /moveSearchSelection\(-1\)/);
  assert.match(dialog, /onClose\(\)/);
});
