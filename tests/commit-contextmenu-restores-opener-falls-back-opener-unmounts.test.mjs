import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const menuStart = source.indexOf('function ContextMenu(');
const menuEnd = source.indexOf('\n    /**\n     * One compact action bar', menuStart);
const menu = source.slice(menuStart, menuEnd);
const dialogStart = source.indexOf('function SearchEverywhere(');
const dialogEnd = source.indexOf('export { SearchEverywhere };', dialogStart);
const dialog = source.slice(dialogStart, dialogEnd);

test('ContextMenu restores its opener and falls back when the opener unmounts', () => {
  assert.match(menu, /previous !== null && previous\.isConnected/);
  assert.match(menu, /previous\.focus\(\)/);
  assert.match(menu, /menu\.fallbackFocus\?\.\(\)/);
  assert.doesNotMatch(menu, /document\.body\.focus/);
});

test('all Search Everywhere context menus fall back to the query', () => {
  const fallback = 'fallbackFocus: () => searchInputRef.current?.focus?.()';
  assert.equal((dialog.match(/fallbackFocus: \(\) => searchInputRef\.current\?\.focus\?\.\(\)/g) ?? []).length, 5);
  assert.ok(dialog.includes(fallback));
});

test('Filter close explicitly returns to query instead of relying on unmount', () => {
  assert.match(dialog, /const closeFilterMenu = React\.useCallback\(\(\) => \{[\s\S]*?setFilterMenu\(null\);[\s\S]*?searchInputRef\.current\?\.focus/);
  assert.match(dialog, /onClose=\{closeFilterMenu\}/);
});

test('Item Info close remains query-owned rather than opener-owned', () => {
  assert.match(dialog, /const closeResultInfo = React\.useCallback\(\(\) => \{[\s\S]*?setResultInfo\(null\);[\s\S]*?searchInputRef\.current\?\.focus/);
  const itemClose = dialog.slice(
    dialog.indexOf("aria-label={t('editor.searchItemClose')}"),
    dialog.indexOf('×', dialog.indexOf("aria-label={t('editor.searchItemClose')}")),
  );
  assert.match(itemClose, /onClick=\{closeResultInfo\}/);
});
