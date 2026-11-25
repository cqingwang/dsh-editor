import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Find search option changes clear stale result state in one shared transition', () => {
  const transition = loadTypeScriptFunction(findTool, 'findToolSearchOptionsTransition');
  const current = {
    query: 'needle',
    caseSensitive: false,
    files: [{ path: 'a.ts' }],
    matches: [{ path: 'a.ts', line: 1, column: 1 }],
    index: 4,
    activeRowKey: 'text:a.ts:1:1',
    error: 'old failure',
    loadedGeneration: 7,
    searchGeneration: 7,
  };

  assert.deepEqual(transition(current, { caseSensitive: true }), {
    ...current,
    caseSensitive: true,
    files: [],
    matches: [],
    index: 0,
    activeRowKey: null,
    error: null,
    replacePartialFailure: false,
    replacePartialFailureMessage: null,
    loadedGeneration: -1,
    searchGeneration: 8,
  });
});

test('EditorWorkspace routes every Find search option change through the shared transition', () => {
  assert.match(
    workspace,
    /onToggleCaseSensitive=\{\(\) =>\s+setFindTool\(\(current\) =>\s+current === null\s+\? current\s+: findToolSearchOptionsTransition\(current, \{ caseSensitive: current\.caseSensitive !== true \}\),?\s+\)\s+\}/u,
  );
  assert.equal((workspace.match(/findToolSearchOptionsTransition\(/g) ?? []).length, 6);
});
