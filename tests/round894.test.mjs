import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitGraphFoldBar owns fold toggle and row-count semantics', async () => {
  const bar = await read('src/client/components/commit/CommitGraphFoldBar.tsx');

  assert.match(bar, /export interface CommitGraphFoldBarProps/u);
  assert.match(bar, /function CommitGraphFoldBar\(/u);
  assert.match(bar, /className='dsh-editor-graph-fold-toggle'/u);
  assert.match(bar, /aria-pressed=\{folded\}/u);
  assert.match(bar, /aria-describedby=\{folded \? 'dsh-editor-graph-fold-count' : undefined\}/u);
  assert.match(bar, /title=\{t\('editor\.graphFoldChains'\)\}/u);
  assert.match(bar, /onClick=\{onToggleFolded\}/u);
  assert.match(bar, /rowCount === 1[\s\S]*?graphFoldedCountOne/u);
  assert.match(bar, /t\('editor\.graphFoldedCount'/u);
  assert.match(bar, /id='dsh-editor-graph-fold-count'/u);
  assert.match(bar, /rowCount/u);
  assert.doesNotMatch(bar, /React\.createElement/u);
});

test('CommitGraph delegates the fold toolbar to CommitGraphFoldBar', async () => {
  const graph = await read('src/client/components/commit/CommitGraph.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(graph, /import \{ CommitGraphFoldBar \} from '\.\/CommitGraphFoldBar'/u);
  assert.match(graph, /<CommitGraphFoldBar[\s\S]*?folded=\{folded\}[\s\S]*?rowCount=\{rowsToDraw\.length\}/u);
  assert.match(graph, /onToggleFolded=\{onToggleFolded\}/u);
  assert.doesNotMatch(graph, /styles\.graphFoldRow/u);
  assert.match(build, /CommitGraphFoldBar\.tsx/u);
  assert.match(client, /function CommitGraphFoldBar\(/u);
});
