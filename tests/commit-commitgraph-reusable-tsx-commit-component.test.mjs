import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitGraph is a reusable TSX commit component', async () => {
  const component = await read('src/client/components/commit/CommitGraph.tsx');
  const row = await read('src/client/components/commit/CommitGraphRow.tsx');

  assert.match(component, /export interface CommitGraphProps/u);
  assert.match(component, /function CommitGraphView\(/u);
  assert.match(component, /import \{ CommitGraphRow(?:, type CommitGraphRun)? \} from '\.\/CommitGraphRow'/u);
  assert.match(component, /<CommitGraphRow/u);
  assert.match(row, /data-dsh-graph-hash=\{entry\.hash\}/u);
  assert.match(row, /aria-haspopup='menu'/u);
  assert.match(component, /const CommitGraph = CommitGraphView;/u);
  assert.match(component, /export \{ CommitGraph \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n    <div\n      style=\{styles\.commitGraph\}/u);
});
