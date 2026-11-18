import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source =
  workspaceSource +
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
  let state = {
    find: 'a',
    replace: '',
    index: 0,
    total: 1,
    error: null,
    scope: null,
    withReplace: false,
  };
  const openEditorFindInSelection = loadTypeScriptCallback(workspaceSource, 'openEditorFindInSelection', {
    currentCodeEditor: () => ({ getModel: () => ({ getValue: () => 'a' }) }),
    readSearchOptions: () => ({}),
    editorFindResult: () => ({ matches: [{ offset: 0, length: 1, text: 'a' }], error: null }),
    setReplaceState: (updater) => {
      state = updater(state);
    },
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });
  openEditorFindInSelection({ start: 0, end: 1 }, true, null, null);
  assert.equal(state.withReplace, true);
  openEditorFindInSelection({ start: 0, end: 1 }, null, null, null);
  assert.equal(state.withReplace, true);
});

test('Replace in Selection Only is localized in both dictionaries', () => {
  assert.match(source, /replaceInSelectionOnly: '仅在选区内替换'/);
  assert.match(source, /replaceInSelectionOnly: 'Replace in Selection Only'/);
});
