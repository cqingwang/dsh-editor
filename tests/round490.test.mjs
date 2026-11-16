import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function searchEverywhere() {
  const start = source.indexOf('function SearchEverywhere(');
  const end = source.indexOf('function FindToolWindow(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Search Everywhere receives the workspace replacement history', () => {
  const dialog = searchEverywhere();
  const render = source.slice(source.indexOf('React.createElement(SearchEverywhere'), source.indexOf('quickOpen === null'));
  assert.match(dialog, /replaceHistory,/);
  assert.match(render, /replaceHistory: recentReplacements/);
});

test('Replace history opens from the field and the toolbar button with the same menu', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /const \[replaceHistoryMenu, setReplaceHistoryMenu\] = React\.useState\(null\)/);
  assert.match(dialog, /const openReplaceHistoryMenu = \(event\) =>/);
  assert.match(dialog, /event\.altKey === true && event\.key === 'ArrowDown'/);
  assert.match(dialog, /icon: 'history'/);
  assert.match(dialog, /label: t\('editor\.findReplaceHistory'\)/);
  assert.match(dialog, /onClick: \(event\) => openReplaceHistoryMenu\(event\)/);
  assert.match(dialog, /onClose: \(\) => setReplaceHistoryMenu\(null\)/);
});

test('Replace history preserves the draft until the user chooses an item', () => {
  const dialog = searchEverywhere();
  const open = dialog.slice(
    dialog.indexOf('const openReplaceHistoryMenu = (event) =>'),
    dialog.indexOf('const headerActions = [', dialog.indexOf('const openReplaceHistoryMenu = (event) =>')),
  );
  assert.match(open, /event\.preventDefault\(\)/);
  assert.match(open, /event\.stopPropagation\(\)/);
  assert.match(open, /Array\.isArray\(replaceHistory\) \? replaceHistory : \[\]/);
  assert.match(open, /t\('editor\.findHistoryEmpty'\)/);
  assert.match(open, /onReplaceChange\(value\)/);
  assert.doesNotMatch(open, /onReplaceChange\(state\.replace\)/);
});

test('Search Everywhere exposes one non-duplicated live result status', () => {
  const dialog = searchEverywhere();
  assert.match(dialog, /const searchResultStatus = textLoading/);
  assert.match(dialog, /'aria-live': 'polite'/);
  assert.match(dialog, /'aria-atomic': 'true'/);
  assert.match(dialog, /role: 'status'/);
  assert.match(dialog, /styles\.screenReaderOnly/);
  assert.match(dialog, /t\('editor\.searchResultCount', \{ count: results\.length \}\)/);
  assert.match(dialog, /textLoading && effectiveTab !== 'actions'\s+\? React\.createElement\('div', \{ style: styles\.searchEverywhereMessage \}, t\('editor\.loading'\)\)/);
});
