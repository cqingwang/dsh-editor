import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function loadMoveEntry(overrides = {}) {
  const calls = [];
  const moveEntry = loadTypeScriptCallback(source, 'moveEntry', {
    beginCommitOperation: () => true,
    endCommitOperation: () => {},
    rows: [],
    callFs: async () => [],
    planMoves: () => ({ moves: [], conflicts: [], intoSelf: [], unchanged: [] }),
    dirname: (path) => path.slice(0, Math.max(0, path.lastIndexOf('/'))),
    basename: (path) => path.slice(path.lastIndexOf('/') + 1),
    describeMoveResult: () => null,
    describeMoved: () => '',
    t: (key) => key,
    remapEditorPaths: () => {},
    remapProjectExpandedPathsForMoves: () => {},
    remapProjectManualOrderForMoves: () => {},
    applyTreeSelection: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
    setTreeError: () => {},
    focusProjectAfterOption: () => calls.push('focus'),
    ...overrides,
  });
  return { moveEntry, calls };
}

test('a completed Move to operation returns keyboard ownership to the Project tree', async () => {
  const { moveEntry, calls } = loadMoveEntry({
    callFs: async (payload) => {
      if (payload.op === 'exists') return [];
      calls.push(payload.op);
      return {};
    },
    planMoves: () => ({
      moves: [{ from: 'row-a.txt', to: 'target/row-a.txt' }],
      conflicts: [],
      intoSelf: [],
      unchanged: [],
    }),
    refreshTree: async () => calls.push('refresh'),
    loadGit: async () => calls.push('git'),
  });

  await moveEntry('row-a.txt', 'target');

  assert.deepEqual(calls, ['rename', 'refresh', 'git', 'focus']);
});

test('a refused Move to operation also returns keyboard ownership to the Project tree', async () => {
  const { moveEntry, calls } = loadMoveEntry({
    planMoves: () => ({
      moves: [],
      conflicts: [{ from: 'row-a.txt', to: 'target/row-a.txt', reason: 'exists' }],
      intoSelf: [],
      unchanged: [],
    }),
  });

  await moveEntry('row-a.txt', 'target');

  assert.deepEqual(calls, ['focus']);
});
