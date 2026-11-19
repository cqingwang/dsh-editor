import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('an existing Graph exposes busy state while its refresh is loading', async () => {
  const graph = await read('src/client/components/commit/CommitGraph.tsx');
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(graph, /busy\?: boolean;/u);
  assert.match(graph, /aria-busy=\{busy \? true : undefined\}/u);
  assert.match(log, /<CommitGraph[\s\S]*?busy=\{loading\}/u);
});
