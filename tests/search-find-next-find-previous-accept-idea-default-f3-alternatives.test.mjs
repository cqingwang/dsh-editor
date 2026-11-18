import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');

function extractFunction(name) {
  return transpileTypeScriptFunction(foundationSource, name);
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

test('Find Next and Find Previous accept IDEA default F3 alternatives', () => {
  const match = new Function(
    `${extractFunction('ideaFindStepShortcutAction')}; return ideaFindStepShortcutAction;`,
  )();
  assert.equal(match(event('F3'), true), 1);
  assert.equal(match(event('F3', { shiftKey: true }), true), -1);
  assert.equal(match(event('F3'), false), 1);
  assert.equal(match(event('F3', { shiftKey: true }), false), -1);
  assert.equal(match(event('F3', { metaKey: true }), true), 0);
  assert.equal(match(event('F3', { altKey: true }), true), 0);
  assert.equal(match(event('F3', { isComposing: true }), true), 0);
});

test('macOS Control+L alternatives do not steal non-macOS Go to Line', () => {
  const match = new Function(
    `${extractFunction('ideaFindStepShortcutAction')}; return ideaFindStepShortcutAction;`,
  )();
  assert.equal(match(event('l', { ctrlKey: true }), true), 1);
  assert.equal(match(event('l', { ctrlKey: true, shiftKey: true }), true), -1);
  assert.equal(match(event('l', { ctrlKey: true }), false), 0);
  assert.equal(match(event('l', { metaKey: true }), true), 0);
});

test('Action rows keep Cmd+G as the visible primary shortcut', () => {
  const actionsStart = source.indexOf('const searchEverywhereActions =');
  const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
  const actions = source.slice(actionsStart, actionsEnd);
  const next = actions.slice(actions.indexOf("id: 'findNext'"), actions.indexOf("id: 'findPrevious'"));
  const previous = actions.slice(actions.indexOf("id: 'findPrevious'"), actions.indexOf("id: 'searchInChanges'"));
  assert.match(next, /shortcut: '⌘G'/);
  assert.match(previous, /shortcut: '⇧⌘G'/);
  assert.doesNotMatch(next, /shortcut: 'F3'/);
  assert.doesNotMatch(previous, /shortcut: '⇧F3'/);
});

test('Find step alternatives only run when editor Find has an active query', () => {
  const start = source.indexOf('const findStepDirection = ideaFindStepShortcutAction');
  assert.notEqual(start, -1, 'Find step keyboard dispatch is missing');
  const end = source.indexOf('const key = event.key.toLowerCase()', start);
  const listener = source.slice(start, end);
  assert.match(listener, /editorFindQueryActiveRef\.current !== true/);
  assert.match(listener, /\[data-dsh-editor-terminal\]/);
  assert.match(listener, /\[role="tree"\]/);
  assert.match(listener, /\[data-dsh-find-tool-window\]/);
  assert.match(listener, /editorFindStepRef\.current\?\.\(findStepDirection\)/);
  assert.match(listener, /event\.preventDefault\(\)/);
  assert.match(listener, /event\.stopPropagation\(\)/);
});
