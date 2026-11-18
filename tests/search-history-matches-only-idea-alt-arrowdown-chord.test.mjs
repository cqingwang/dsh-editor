import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const dialogStart = source.indexOf('function SearchEverywhere(');
const dialogEnd = source.indexOf('function FindToolWindowView(', dialogStart);
const dialog = source.slice(dialogStart, dialogEnd);

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function event(key, modifiers = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...modifiers,
  };
}

test('Show Search History matches only its IDEA Alt+ArrowDown chord', () => {
  const matches = new Function(
    `${extractFunction('searchHistoryShortcutMatches')}; return searchHistoryShortcutMatches;`,
  )();
  assert.equal(matches(event('ArrowDown', { altKey: true })), true);
  assert.equal(matches(event('ArrowDown')), false);
  assert.equal(matches(event('ArrowDown', { altKey: true, metaKey: true })), false);
  assert.equal(matches(event('ArrowDown', { altKey: true, ctrlKey: true })), false);
  assert.equal(matches(event('ArrowDown', { altKey: true, shiftKey: true })), false);
  assert.equal(matches(event('ArrowDown', { altKey: true, isComposing: true })), false);
});

test('the whole Search Everywhere dialog owns Show Search History', () => {
  assert.match(dialog, /const openSearchHistoryShortcut = \(event\) =>/);
  assert.match(dialog, /openQueryHistoryMenuAt\(rect\)/);
  assert.match(dialog, /searchInputRef\.current\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(dialog, /onKeyDown: handleSearchEverywhereDialogKeyDown/);
  assert.match(dialog, /const handleSearchEverywhereDialogKeyDown = \(event\) =>[\s\S]*?openSearchHistoryShortcut\(event\)/);
  assert.match(dialog, /event\.preventDefault\(\)/);
  assert.match(dialog, /event\.stopPropagation\(\)/);
});

test('query and replacement fields keep their own Alt+ArrowDown histories', () => {
  assert.match(dialog, /'data-dsh-search-query': ''/);
  assert.match(dialog, /'data-dsh-search-replace-input': ''/);
  assert.match(
    dialog,
    /closest\('\[data-dsh-search-query\], \[data-dsh-search-replace-input\]'\)/,
  );
  assert.match(dialog, /onReplaceChange\(value\)/);
  assert.match(dialog, /openReplaceHistoryMenu\(event\)/);
});

test('Show Search History remains the visible Alt+Down Action shortcut', () => {
  const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
  const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
  const actions = source.slice(actionsStart, actionsEnd);
  const action = actions.slice(actions.indexOf("id: 'showSearchHistory'"), actions.indexOf("id: 'recentFindUsages'"));
  assert.match(action, /shortcut: '⌥↓'/);
  assert.match(action, /setSearchHistoryRequest\(\(current\) => current \+ 1\)/);
});
