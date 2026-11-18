import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('./fixtures/context-menu.legacy.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const popupStart = source.indexOf('function ShowUsagesPopup(');
const popupEnd = source.indexOf('function FindToolWindow(', popupStart);
const popup = source.slice(popupStart, popupEnd);
const contextStart = source.indexOf('function ContextMenu(');
const contextEnd = source.indexOf('function CompactActionBar(', contextStart);
const contextMenu = source.slice(contextStart, contextEnd);

test('right-click focuses the usage row before ContextMenu records its opener', () => {
  const openUsageMenu = popup.slice(
    popup.indexOf('const openUsageMenu = (event, match) => {'),
    popup.indexOf('const openActiveUsageMenu =', popup.indexOf('const openUsageMenu = (event, match) => {')),
  );
  assert.match(openUsageMenu, /event\.preventDefault\(\)/);
  assert.match(openUsageMenu, /event\.stopPropagation\(\)/);
  assert.match(openUsageMenu, /event\.currentTarget\?\.focus\?\.\(\)/);
  assert.ok(openUsageMenu.indexOf('event.currentTarget?.focus?.()') < openUsageMenu.indexOf('openUsageMenuAt('));
});

test('the shared ContextMenu restores its actual opener instead of leaving focus on body', () => {
  assert.match(contextMenu, /returnFocusRef = React\.useRef\(null\)/);
  assert.match(contextMenu, /document\.activeElement instanceof HTMLElement \? document\.activeElement : null/);
  assert.match(contextMenu, /previous\.isConnected\) previous\.focus\(\)/);
  assert.match(contextMenu, /skipReturnFocusRef/);
});

test('copy actions close only the menu, while navigation actions close the usage popup', () => {
  const menuBuilder = popup.slice(popup.indexOf('const openUsageMenuAt ='), popup.indexOf('const openUsageMenu ='));
  assert.match(menuBuilder, /onCloseMenu: \(\) => setResultMenu\(null\)/);
  assert.doesNotMatch(menuBuilder, /id: 'copyRelative'[\s\S]*?onClose\(\)/);
  assert.match(menuBuilder, /onOpenInRightSplit: \(\) => \{[\s\S]*?onClose\(\);[\s\S]*?onOpenInRightSplit\(/);
  assert.match(menuBuilder, /onRevealResult: \(\) => \{[\s\S]*?onClose\(\);[\s\S]*?onRevealResult\(/);
});

test('clipboard rejection remains a notification path and does not close the popup', () => {
  const copy = source.slice(
    source.indexOf('function copySearchResultText('),
    source.indexOf('function searchResultContextItems('),
  );
  assert.match(copy, /onNotify\(t\('editor\.clipboardWriteFailed'\)\)/);
  assert.match(copy, /\.\s*catch\(\(\) => onNotify\(t\('editor\.clipboardWriteFailed'\)\)\)/u);
  assert.doesNotMatch(copy, /closeSearch|onClose|setShowUsages/);
});
