import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');

test('Search Everywhere group navigation follows the active platform keymap', () => {
  const fn = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereGroupNavigationDirection')}; return searchEverywhereGroupNavigationDirection;`,
  )();
  const key = (value, modifiers = {}) => ({
    key: value,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  });

  assert.equal(fn(key('PageDown'), true), 1);
  assert.equal(fn(key('PageUp'), true), -1);
  assert.equal(fn(key('ArrowDown', { metaKey: true }), true), 1);
  assert.equal(fn(key('ArrowUp', { metaKey: true }), true), -1);
  assert.equal(fn(key('ArrowDown', { ctrlKey: true }), true), 0);
  assert.equal(fn(key('ArrowDown', { ctrlKey: true }), false), 1);
  assert.equal(fn(key('ArrowUp', { ctrlKey: true }), false), -1);
  assert.equal(fn(key('ArrowDown', { metaKey: true }), false), 0);
  assert.equal(fn(key('ArrowDown', { metaKey: true, shiftKey: true }), true), 0);
  assert.equal(fn(key('ArrowDown', { metaKey: true, altKey: true }), true), 0);
  assert.equal(fn(key('ArrowDown', { metaKey: true, ctrlKey: true }), true), 0);
  assert.equal(fn(key('Escape'), true), 0);
});

test('Search Everywhere keydown delegates grouping to the platform-aware helper', () => {
  const handler = source.slice(
    source.indexOf('const handleSearchResultKeyDown = (event) => {'),
    source.indexOf('const openSearchResultsInFind =', source.indexOf('const handleSearchResultKeyDown = (event) => {')),
  );
  assert.match(handler, /isMacPlatform\(navigator\.userAgentData\?\.platform \?\? navigator\.platform\)/);
  assert.match(handler, /searchEverywhereGroupNavigationDirection\(event, macPlatform\)/);
  assert.match(handler, /searchEverywhereGroupTargetIndex\(results, activeIndex, groupDirection\)/);
  assert.match(handler, /event\.preventDefault\(\)/);
  assert.match(handler, /event\.stopPropagation\(\)/);
});

test('Show Search History exposes IDEA default Alt+Down metadata', () => {
  const start = source.indexOf("id: 'showSearchHistory'");
  const end = source.indexOf("id: 'recentFindUsages'", start);
  const action = source.slice(start, end);
  assert.match(action, /shortcut: '⌥↓'/);
});

test('arrow glyph shortcuts normalize to WAI-ARIA key names', () => {
  const fn = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereAriaKeyShortcuts')}; return searchEverywhereAriaKeyShortcuts;`,
  )();
  assert.equal(fn('⌥↓'), 'Alt+ArrowDown');
  assert.equal(fn('⇧↑'), 'Shift+ArrowUp');
  assert.equal(fn('⌘→'), 'Meta+ArrowRight');
  assert.equal(fn('⌃←'), 'Control+ArrowLeft');
});
