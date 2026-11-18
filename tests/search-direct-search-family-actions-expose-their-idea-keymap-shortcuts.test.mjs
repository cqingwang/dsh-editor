import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

function extractFunction(name) {
  return transpileTypeScriptFunction(source, name);
}

function actionBlock(id, nextId) {
  const start = actions.indexOf(`id: '${id}'`);
  const end = actions.indexOf(`id: '${nextId}'`, start);
  return actions.slice(start, end < 0 ? actions.length : end);
}

test('direct search-family actions expose their IDEA keymap shortcuts', () => {
  for (const [id, nextId, shortcut] of [
    ['textSearch', 'findAction', '⌃⇧⌥E'],
    ['findUsagesInFile', 'highlightUsagesInFile', '⌘F7'],
    ['highlightUsagesInFile', 'searchWeb', '⇧⌘F7'],
    ['findNextWordOccurrence', 'findPreviousWordOccurrence', '⌃F3'],
    ['findPreviousWordOccurrence', 'selectAllOccurrences', '⌃⇧F3'],
  ]) {
    const block = actionBlock(id, nextId);
    assert.match(block, new RegExp(`shortcut: '${shortcut}'`), `${id} is missing ${shortcut}`);
  }
});

test('shortcut metadata normalizes the newly audited chords', () => {
  const normalize = new Function(
    `${extractFunction('searchEverywhereAriaKeyShortcuts')}; return searchEverywhereAriaKeyShortcuts;`,
  )();
  assert.equal(normalize('⌃⇧⌥E'), 'Control+Shift+Alt+E');
  assert.equal(normalize('⌘F7'), 'Meta+F7');
  assert.equal(normalize('⇧⌘F7'), 'Shift+Meta+F7');
  assert.equal(normalize('⌃F3'), 'Control+F3');
  assert.equal(normalize('⌃⇧F3'), 'Control+Shift+F3');
});

test('conflicting Alt+3 remains an activity shortcut, not a Find action shortcut', () => {
  const block = actionBlock('findToolWindow', 'replace');
  assert.doesNotMatch(block, /shortcut:/);
});
