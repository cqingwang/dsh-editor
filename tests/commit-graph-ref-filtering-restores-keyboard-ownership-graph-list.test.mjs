import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph ref filtering restores keyboard ownership to the graph list', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(
    log,
    /onPickRef=\{\(ref\) => \{[\s\S]*?onGraphRef\?\.\(ref\)[\s\S]*?listRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/u,
  );
  assert.match(
    log,
    /onGraphBranch=\{\(branch\) => \{[\s\S]*?branch === ''[\s\S]*?listRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/u,
  );
});

test('Graph scope chip exposes grouping, clear action and bounded label', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(toolbar, /role='group'/u);
  assert.match(toolbar, /className='dsh-editor-log-toolbar'/u);
  assert.match(toolbar, /className='dsh-editor-log-title'/u);
  assert.match(toolbar, /className='dsh-editor-log-branch'/u);
  assert.match(toolbar, /className='dsh-editor-log-scope'/u);
  assert.match(toolbar, /className='dsh-editor-log-author'/u);
  assert.match(toolbar, /className='dsh-editor-log-actions'/u);
  assert.match(toolbar, /aria-label=\{t\('editor\.graphAtChip'/u);
  assert.match(toolbar, /className='dsh-editor-graph-scope-label'/u);
  assert.match(toolbar, /className='dsh-editor-graph-scope-clear'/u);
  assert.match(toolbar, /aria-label=\{t\('editor\.graphClearScope'\)\}/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-label \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:focus-visible \{ outline: 1px solid var\(--dsw-alias-state-business-primary\); outline-offset: 1px; border-radius: 3px; \}/u,
  );
  assert.match(
    injectedCss,
    /@container \(max-width: 520px\) \{[\s\S]*?\.dsh-editor-log-toolbar \{ height: auto !important; min-height: 26px; flex-wrap: wrap !important;[\s\S]*?\.dsh-editor-log-title \{ display: none !important; \}[\s\S]*?\.dsh-editor-log-scope \{ order: 3; flex: 1 1 80px !important; min-width: 0 !important; max-width: 160px !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\[data-dsh-log-panel\] > div:first-child \{ overflow: clip !important; \}/u,
  );
});

test('Graph scope accessibility is present in the built client', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(build, /CommitLogToolbar\.tsx/u);
  assert.match(client, /dsh-editor-graph-scope-label/u);
  assert.match(client, /dsh-editor-graph-scope-clear/u);
  assert.match(client, /onPickRef: \(ref\) => \{/u);
});
