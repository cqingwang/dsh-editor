import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('IDEA parity keeps Search Everywhere history read-only', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const queryMenu = dialog.slice(
    dialog.indexOf('const openQueryHistoryMenuAt'),
    dialog.indexOf('const openQueryHistoryMenu =', dialog.indexOf('const openQueryHistoryMenuAt')),
  );
  const replaceMenu = dialog.slice(
    dialog.indexOf('const openReplaceHistoryMenu'),
    dialog.indexOf('const openSearchHistoryShortcut', dialog.indexOf('const openReplaceHistoryMenu')),
  );
  for (const menu of [queryMenu, replaceMenu]) {
    assert.doesNotMatch(menu, /deleteHistory|clearHistory|Clear History|Delete History/iu);
    assert.doesNotMatch(menu, /id: 'delete'|id: 'clear'/u);
  }
  assert.match(queryMenu, /run: \(\) => onQuery\(value\)/);
  assert.match(replaceMenu, /run: \(\) => onReplaceChange\(value\)/);
});

test('history menus preserve replay and fallback focus behavior', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /fallbackFocus: \(\) => searchInputRef\.current\?\.focus\?\.\(\)/);
  assert.match(dialog, /onClose: closeFilterMenu/);
  assert.match(source, /menu\.fallbackFocus\?\.\(\)/);
});
