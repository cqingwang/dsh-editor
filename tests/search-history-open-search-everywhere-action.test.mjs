import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);
const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));

test('Show Search History is a keep-open Search Everywhere action', () => {
  assert.match(actions, /id: 'showSearchHistory'/);
  assert.match(actions, /label: t\('editor\.showSearchHistoryAction'\)/);
  assert.match(actions, /keepOpen: true/);
  assert.match(actions, /rememberQuery: false/);
  assert.match(actions, /setSearchEverywhere\(\(current\) => current === null \? current : \{ \.\.\.current, tab: 'all', index: 0 \}\)/);
  assert.match(actions, /setSearchHistoryRequest\(\(current\) => current \+ 1\)/);
});

test('action activation respects keepOpen instead of closing every action', () => {
  assert.match(source, /if \(result\.kind === 'action'\) \{/);
  assert.match(source, /if \(result\.keepOpen !== true\) setSearchEverywhere\(null\);/);
  assert.match(source, /result\.run\?\.\(\);/);
  assert.match(source, /result\.rememberQuery !== false/u);
});

test('the history request opens the shared menu without replacing the draft', () => {
  const historyStart = dialog.indexOf('const openQueryHistoryMenu =');
  const requestEffect = dialog.slice(historyStart, dialog.indexOf('const openReplaceHistoryMenu', historyStart));
  assert.match(dialog, /historyRequest,/);
  assert.match(dialog, /searchInputRef\.current\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(dialog, /openQueryHistoryMenuAt\(rect\)/);
  assert.match(dialog, /\[historyRequest, openQueryHistoryMenuAt\]/);
  assert.doesNotMatch(requestEffect, /onQuery\(/);
  assert.match(dialog, /onClose: \(\) => setQueryHistoryMenu\(null\)/);
});

test('Show Search History is localized in both dictionaries', () => {
  assert.match(source, /showSearchHistoryAction: '显示搜索历史'/);
  assert.match(source, /showSearchHistoryAction: 'Show Search History'/);
});
