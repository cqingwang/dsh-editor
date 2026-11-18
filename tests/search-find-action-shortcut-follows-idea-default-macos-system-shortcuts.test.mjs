import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const findToolWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const source = [searchEverywhereSource, findToolWindowSource, workspaceSource, foundationSource].join('\n');
const actions = workspaceSource.slice(
  workspaceSource.indexOf('const searchEverywhereActions ='),
  workspaceSource.indexOf('/* Recompute match count'),
);

function extractFunction(name) {
  return transpileTypeScriptFunction(foundationSource, name);
}

test('Find Action shortcut follows IDEA default and macOS System Shortcuts keymaps', () => {
  const matches = new Function(
    `${extractFunction('findActionShortcutMatches')}; return findActionShortcutMatches;`,
  )();
  const event = (key, modifiers = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: true,
    isComposing: false,
    ...modifiers,
  });
  assert.equal(matches(event('a', { metaKey: true }), true), true);
  assert.equal(matches(event('p', { metaKey: true }), true), true);
  assert.equal(matches(event('A', { ctrlKey: true }), false), true);
  assert.equal(matches(event('a', { ctrlKey: true }), true), false);
  assert.equal(matches(event('a', { metaKey: true }), false), false);
  assert.equal(matches(event('a', { metaKey: true, altKey: true }), true), false);
  assert.equal(matches(event('a', { metaKey: true, shiftKey: false }), true), false);
  assert.equal(matches(event('a', { metaKey: true, isComposing: true }), true), false);
});

test('Find Action advertises its primary macOS shortcut', () => {
  const start = actions.indexOf("id: 'findAction'");
  const end = actions.indexOf("id: '", start + 1);
  const action = actions.slice(start, end < 0 ? actions.length : end);
  assert.match(action, /shortcut: '⇧⌘A'/);
});

test('Search Everywhere owns Find Action chords without closing the dialog', () => {
  const component = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(component, /findActionShortcutMatches\(event, macPlatform\)/);
  assert.match(component, /onQuery\(''\)/);
  assert.match(component, /onTab\('actions'\)/);
  assert.match(component, /data-dsh-search-query/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(component.slice(
    component.indexOf('const findActionShortcut ='),
    component.indexOf("window.addEventListener('keydown', onKeyDown, true)", component.indexOf('const findActionShortcut =')),
  ), /onClose\(\)/);
});
