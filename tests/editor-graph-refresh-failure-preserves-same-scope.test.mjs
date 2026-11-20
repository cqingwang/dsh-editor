import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function loadGraphWithFailure(initialGraph) {
  let graph = initialGraph;
  return read('src/client/editor-workspace.tsx').then((workspace) => {
    const loadGraph = loadTypeScriptCallback(workspace, 'loadGraph', {
      git: { isRepo: true },
      callGit: async () => {
        throw new Error('graph failed');
      },
      beginLogRequest: () => new AbortController(),
      finishLogRequest: () => {},
      setGraph: (update) => {
        graph = typeof update === 'function' ? update(graph) : update;
      },
      setLogError: () => {},
    });
    return { loadGraph, current: () => graph };
  });
}

test('a failed same-scope Graph refresh keeps the existing graph', async () => {
  const { loadGraph, current } = await loadGraphWithFailure({
    entries: [{ hash: 'old' }],
    branch: 'main',
    at: null,
  });

  await loadGraph('main', '');

  assert.equal(current().entries[0].hash, 'old');
  assert.equal(current().branch, 'main');
});

test('a failed Graph scope change replaces data with the requested empty scope', async () => {
  const { loadGraph, current } = await loadGraphWithFailure({
    entries: [{ hash: 'old' }],
    branch: 'main',
    at: null,
  });

  await loadGraph('feature', '');

  assert.deepEqual(current().entries, []);
  assert.equal(current().branch, 'feature');
});
