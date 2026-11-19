import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph initial loading is owned by the Graph status placeholder', async () => {
  const state = await read('src/client/components/commit/CommitLogListState.tsx');
  const graph = await read('src/client/components/commit/CommitGraph.tsx');

  assert.match(state, /section === 'status' && !graphMode && loading && logFailure === null/u);
  assert.match(graph, /data-dsh-graph-state=\{placeholder\.kind\}/u);
  assert.match(graph, /aria-busy=\{placeholder\.kind === 'loading' \? true : undefined\}/u);
});
