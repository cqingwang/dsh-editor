import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitGraphRow owns row semantics and IDEA decorations', async () => {
  const row = await read('src/client/components/commit/CommitGraphRow.tsx');

  assert.match(row, /export interface CommitGraphRowProps/u);
  assert.match(row, /function CommitGraphRow\(/u);
  assert.match(row, /role='option'/u);
  assert.match(row, /data-dsh-graph-hash=\{entry\.hash\}/u);
  assert.match(row, /aria-haspopup='menu'/u);
  assert.match(row, /aria-selected=\{active\}/u);
  assert.match(row, /hovered = false/u);
  assert.match(row, /\.\.\.\(active \|\| hovered \? styles\.commitGraphRowActive : null\)/u);
  assert.match(row, /ref=\{rowRef\}/u);
  assert.match(row, /styles\.commitGraphLane/u);
  assert.match(row, /styles\.commitGraphHead/u);
  assert.match(row, /styles\.graphFoldBadge/u);
  assert.match(row, /t\('editor\.graphFilterByRef'/u);
  assert.match(row, /aria-label=\{t\('editor\.graphFilterByRef'/u);
  assert.match(row, /foldedCommitCount === 1[\s\S]*?graphFoldedRunOne/u);
  assert.match(row, /t\('editor\.graphFoldedRun'/u);
  assert.match(row, /onContextMenu\?\.\(/u);
  assert.doesNotMatch(row, /React\.createElement/u);
});

test('CommitGraph delegates each graph row to CommitGraphRow', async () => {
  const graph = await read('src/client/components/commit/CommitGraph.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(graph, /import \{ CommitGraphRow(?:, type CommitGraphRun)? \} from '\.\/CommitGraphRow'/u);
  assert.match(graph, /<CommitGraphRow[\s\S]*?entry=\{entry\}[\s\S]*?run=\{run(?:\s+as\s+[^}]+)?\}/u);
  assert.match(graph, /rowRef=\{active \? scrollGraphRowIntoView : undefined\}/u);
  assert.match(graph, /hovered=\{rowHovered\}/u);
  assert.match(graph, /onPickRef=\{onPickRef\}/u);
  assert.doesNotMatch(graph, /data-dsh-graph-hash=\{entry\.hash\}/u);
  assert.match(build, /CommitGraphRow\.tsx/u);
  assert.match(client, /function CommitGraphRow\(/u);
});

test('Graph hover is visual only and does not change aria-selected', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const graph = await read('src/client/components/commit/CommitGraph.tsx');

  assert.match(log, /selected=\{graphCursor \?\? selected\}/u);
  assert.match(log, /hovered=\{graphHover\}/u);
  assert.match(graph, /const rowHovered = hovered === entry\.hash;/u);
  assert.match(graph, /active=\{active\}/u);
});
