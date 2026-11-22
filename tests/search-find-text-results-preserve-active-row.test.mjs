import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commit = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');

test('Find results recover the active text row after asynchronous result reordering', () => {
  const reconcile = loadTypeScriptFunction(findTool, 'findToolReconciledResultRow');

  assert.deepEqual(
    reconcile(
      [
        { rowKey: 'file:a.ts' },
        { rowKey: 'text:new.ts:1:1' },
        { rowKey: 'text:target.ts:4:2' },
        { rowKey: 'text:z.ts:1:1' },
      ],
      1,
      'text:target.ts:4:2',
    ),
    { index: 2, rowKey: 'text:target.ts:4:2' },
  );
  assert.deepEqual(
    reconcile(
      [{ rowKey: 'file:a.ts' }, { rowKey: 'text:target.ts:4:2' }],
      1,
      'text:target.ts:4:2',
    ),
    { index: 1, rowKey: 'text:target.ts:4:2' },
  );
  assert.deepEqual(
    reconcile(
      [{ rowKey: 'file:a.ts' }, { rowKey: 'text:new.ts:1:1' }, { rowKey: 'file:z.ts' }],
      1,
      'text:removed.ts:2:1',
    ),
    { index: 1, rowKey: 'text:new.ts:1:1' },
  );
  assert.deepEqual(reconcile([], 7, 'text:removed.ts:2:1'), { index: 0, rowKey: null });
});

test('Find stores the active row identity through every selection and query reset', () => {
  assert.match(panel, /findToolReconciledResultRow\(occurrences, state\.index, state\.activeRowKey\)/u);
  assert.match(panel, /onMove\(0, occurrences\.length, reconciled\.index, reconciled\.rowKey \?\? undefined\)/u);
  assert.match(workspace, /onMove=\{\(direction, count, absolute = null, activeRowKey\) =>/u);
  assert.match(workspace, /moveFindToolSelection\(current, direction, count, absolute, activeRowKey\)/u);
  assert.match(commit, /activeRowKey: null/u);
});
