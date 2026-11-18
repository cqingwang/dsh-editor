import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Replace in Selection Only opens a scoped replace find', () => {
  assert.match(actions, /id: 'replaceInSelectionOnly'/);
  assert.match(actions, /label: t\('editor\.replaceInSelectionOnly'\)/);
  assert.match(actions, /rememberQuery: false/);
  assert.match(actions, /disabled: !hasSelectionScope/);
  assert.match(actions, /openEditorFindInSelection\(selectionScope, true\)/);
});

test('scoped Find preserves or explicitly enables the replace row', () => {
  const open = source.slice(
    source.indexOf('const openEditorFindInSelection = React.useCallback'),
    source.indexOf('/* IDEA\'s editor search family'),
  );
  assert.match(open, /\(scope, withReplace = null, initialQuery = null, focusTarget = null\)/u);
  assert.match(open, /withReplace === null \? base\.withReplace === true : withReplace === true/u);
});

test('Replace in Selection Only is localized in both dictionaries', () => {
  assert.match(source, /replaceInSelectionOnly: '仅在选区内替换'/);
  assert.match(source, /replaceInSelectionOnly: 'Replace in Selection Only'/);
});
