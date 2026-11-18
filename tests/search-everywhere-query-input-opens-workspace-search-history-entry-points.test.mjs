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

test('Search Everywhere query input opens workspace search history from both entry points', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /const \[queryHistoryMenu, setQueryHistoryMenu\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(dialog, /const openQueryHistoryMenu = \(event(?::\s*[^)]+)?\)(?::\s*[^{]+)?/);
  assert.match(dialog, /event\.altKey === true && event\.key === 'ArrowDown'/);
  assert.match(dialog, /icon: 'history'/);
  assert.match(dialog, /label: t\('editor\.findSearchHistory'\)/);
  assert.match(dialog, /onClick: \(event\) => openQueryHistoryMenu\(event\)/);
  assert.match(dialog, /onClose: \(\) => setQueryHistoryMenu\(null\)/);
});

test('Search Everywhere query history reuses recentSearches and preserves the draft', () => {
  const dialog = searchEverywhere();
  const open = dialog.slice(
    dialog.indexOf('const openQueryHistoryMenuAt = React.useCallback'),
    dialog.indexOf('const openQueryHistoryMenu ='),
  );
  const opener = dialog.slice(
    dialog.indexOf('const openQueryHistoryMenu ='),
    dialog.indexOf('const handledHistoryRequestRef'),
  );
  assert.match(opener, /event\.preventDefault\(\)/);
  assert.match(opener, /event\.stopPropagation\(\)/);
  assert.match(opener, /openQueryHistoryMenuAt\(event\.currentTarget\.getBoundingClientRect\(\)\)/);
  assert.match(open, /Array\.isArray\(recentSearches\) \? recentSearches : \[\]/);
  assert.match(open, /t\('editor\.findHistoryEmpty'\)/);
  assert.match(open, /onQuery\(value\)/);
  assert.doesNotMatch(open, /onQuery\(state\.query\)/);
});

test('Search Everywhere keeps query history separate from replacement history', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /queryHistoryMenu === null \? null : \(\s*<ContextMenu/u);
  assert.match(dialog, /replaceHistoryMenu === null \? null : \(\s*<ContextMenu/u);
  assert.match(dialog, /title: t\('editor\.findSearchHistory'\)/);
  assert.match(dialog, /title: t\('editor\.findReplaceHistory'\)/);
});
