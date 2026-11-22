import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Find File keeps the active file when asynchronous candidates reorder', () => {
  const preservedIndex = loadTypeScriptFunction(findTool, 'findToolPreservedFileIndex');

  assert.equal(
    preservedIndex([{ path: 'a.ts' }, { path: 'target.ts' }, { path: 'z.ts' }], [
      { path: 'z.ts' },
      { path: 'a.ts' },
      { path: 'target.ts' },
    ], 1),
    2,
  );
  assert.equal(
    preservedIndex(
      [{ path: 'a.ts' }, { path: 'target.ts' }, { path: 'z.ts' }],
      [{ path: 'a.ts' }, { path: 'z.ts' }],
      1,
    ),
    1,
  );
  assert.equal(preservedIndex([{ path: 'target.ts' }], [], 0), 0);
});

test('Find File applies stable selection while refreshing indexed candidates', () => {
  assert.match(workspace, /findToolPreservedFileIndex\(current\.files, files, current\.index\)/u);
});
