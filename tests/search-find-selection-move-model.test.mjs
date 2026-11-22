import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Find selection movement stays bounded and preserves row identity', () => {
  const move = loadTypeScriptFunction(findTool, 'moveFindToolSelection');

  assert.deepEqual(move({ index: 2, activeRowKey: 'text:a.ts:1:1' }, 1, 3, null, 'text:b.ts:2:2'), {
    index: 0,
    activeRowKey: 'text:b.ts:2:2',
  });
  assert.deepEqual(move({ index: 1, activeRowKey: 'text:a.ts:1:1' }, -1, 4, 9, 'file:z.ts'), {
    index: 3,
    activeRowKey: 'file:z.ts',
  });
  assert.deepEqual(move({ index: 1, activeRowKey: 'file:a.ts' }, 1, 0), {
    index: 0,
    activeRowKey: null,
  });
  assert.deepEqual(move({ index: 1, activeRowKey: 'file:a.ts' }, 1, 4, null, null), {
    index: 2,
    activeRowKey: null,
  });
});

test('EditorWorkspace delegates Find selection movement to the shared model', () => {
  assert.match(
    workspace,
    /onMove=\{\(direction, count, absolute = null, activeRowKey\) =>\s+setFindTool\(\(current\) =>\s+current === null \? current : moveFindToolSelection\(current, direction, count, absolute, activeRowKey\),?\s+\)\s+\}/u,
  );
});
