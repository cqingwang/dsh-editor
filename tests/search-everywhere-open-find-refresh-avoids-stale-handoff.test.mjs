import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('opening Search Everywhere results in Find starts one fresh dock search', () => {
  const refreshHandoff = loadTypeScriptFunction(
    findToolSource.slice(findToolSource.indexOf('export function findToolRefreshHandoff')),
    'findToolRefreshHandoff',
  );
  const initial = {
    query: 'application.java',
    mode: 'find',
    files: [{ path: 'Application.java' }],
    matches: [{ path: 'Application.java', line: 1, column: 1 }],
    index: 2,
    truncated: true,
    caseSensitive: true,
    fileMask: '',
  };
  assert.deepEqual(refreshHandoff(initial), {
    ...initial,
    files: [],
    matches: [],
    index: 0,
    truncated: false,
    refresh: true,
  });
  assert.equal(refreshHandoff({ ...initial, query: '' }).refresh, false);
  assert.equal(refreshHandoff(null), null);
});

test('the editor wires Search Everywhere to Find through the fresh handoff helper', () => {
  assert.match(editorSource, /findToolRefreshHandoff\(initial\)/u);
});
