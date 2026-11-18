import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph fold toggle exposes count and keyboard focus semantics', async () => {
  const bar = await read('src/client/components/commit/CommitGraphFoldBar.tsx');
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(bar, /aria-pressed=\{folded\}/u);
  assert.match(bar, /aria-describedby=\{folded \? 'dsh-editor-graph-fold-count' : undefined\}/u);
  assert.match(bar, /id='dsh-editor-graph-fold-count'/u);
  assert.match(bar, /className='dsh-editor-graph-fold-toggle'/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-fold-toggle:focus-visible \{ outline: 1px solid var\(--dsw-alias-state-business-primary\); outline-offset: 1px; \}/u,
  );
});

test('Graph fold toolbar remains wired through CommitGraph', async () => {
  const graph = await read('src/client/components/commit/CommitGraph.tsx');
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(graph, /<CommitGraphFoldBar[\s\S]*?folded=\{folded\}[\s\S]*?rowCount=\{rowsToDraw\.length\}/u);
  assert.match(
    log,
    /event\.target\.closest\(\s*'button, input, textarea, select, a, \[role="button"\], \[contenteditable="true"\]',?\s*\)/u,
  );
  assert.match(build, /CommitGraphFoldBar\.tsx/u);
  assert.match(client, /dsh-editor-graph-fold-toggle/u);
  assert.match(client, /dsh-editor-graph-fold-count/u);
});
