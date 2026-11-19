import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function applyReplaceShortcut(current, selectedQuery) {
  let next = null;
  let focused = null;
  const callback = loadTypeScriptCallback(workspace, 'openReplaceInFilesFromEditor', {
    currentCodeEditor: () => ({}),
    selectedEditorFindQuery: () => selectedQuery,
    findTool: current,
    openFindTool: () => {
      throw new Error('an already-open Find tool must not be recreated');
    },
    setTerminalOpen: () => {},
    setFindTool: (updater) => {
      next = updater(current);
    },
    window: { setTimeout: (callback) => callback() },
    document: {
      querySelector: () => ({
        focus: () => {
          focused = true;
        },
      }),
    },
  });
  callback();
  return { next, focused };
}

function currentFindState() {
  return {
    query: 'zzzz-no-match-769',
    replace: 'replacement-text-769',
    mode: 'find',
    files: [{ path: 'a.ts' }],
    matches: [{ path: 'b.ts', line: 1, column: 1 }],
    truncated: false,
    loading: false,
    error: null,
    index: 1,
    surface: 'dock',
    replaceBusy: false,
    searchGeneration: 4,
    loadedGeneration: 4,
  };
}

test('repeating Replace in Files preserves the current draft without a selection', () => {
  const current = currentFindState();
  const { next, focused } = applyReplaceShortcut(current, '');

  assert.equal(next.mode, 'replace');
  assert.equal(next.surface, 'popup');
  assert.equal(next.query, current.query);
  assert.equal(next.replace, current.replace);
  assert.deepEqual(next.files, current.files);
  assert.deepEqual(next.matches, current.matches);
  assert.equal(next.index, current.index);
  assert.equal(next.searchGeneration, current.searchGeneration);
  assert.equal(next.loadedGeneration, current.loadedGeneration);
  assert.equal(focused, true);
});

test('a new selection updates only the query and invalidates old results', () => {
  const current = currentFindState();
  const { next, focused } = applyReplaceShortcut(current, 'selected-text');

  assert.equal(next.mode, 'replace');
  assert.equal(next.surface, 'popup');
  assert.equal(next.query, 'selected-text');
  assert.equal(next.replace, current.replace);
  assert.deepEqual(next.files, []);
  assert.deepEqual(next.matches, []);
  assert.equal(next.index, 0);
  assert.equal(next.searchGeneration, current.searchGeneration + 1);
  assert.equal(next.loadedGeneration, -1);
  assert.equal(focused, true);
});
