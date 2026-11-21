import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function applyReplaceShortcut(current, selectedQuery) {
  let forwarded = null;
  const callback = loadTypeScriptCallback(workspace, 'openReplaceInFilesFromEditor', {
    currentCodeEditor: () => ({}),
    selectedEditorFindQuery: () => selectedQuery,
    findTool: current,
    openFindTool: (...args) => {
      forwarded = args;
    },
    setTerminalOpen: () => {},
    setFindTool: () => {
      throw new Error('a docked Find session must not be mutated in place');
    },
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });
  callback();
  return forwarded;
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

test('repeating Replace in Files opens a new popup for the current query', () => {
  const current = currentFindState();
  const forwarded = applyReplaceShortcut(current, '');

  assert.deepEqual(forwarded, [current.query, 'replace', null, 'query', 'popup', true]);
  assert.equal(current.surface, 'dock');
});

test('a new selection opens another popup without mutating the docked session', () => {
  const current = currentFindState();
  const forwarded = applyReplaceShortcut(current, 'selected-text');

  assert.deepEqual(forwarded, ['selected-text', 'replace', null, 'query', 'popup', true]);
  assert.equal(current.query, 'zzzz-no-match-769');
  assert.deepEqual(current.matches, [{ path: 'b.ts', line: 1, column: 1 }]);
});
