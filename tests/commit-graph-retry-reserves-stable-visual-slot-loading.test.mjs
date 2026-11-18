import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph Retry reserves a stable visual slot while loading', async () => {
  const injectedCss = await read('src/client/injected-css.ts');
  const state = await read('src/client/components/commit/CommitLogListState.tsx');
  const client = await read('lib/client.js');

  assert.match(
    injectedCss,
    /\.dsh-editor-log-retry \{ display: inline-flex; align-items: center; justify-content: center; min-width: 64px; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-log-retry\[aria-disabled="true"\] \{ opacity: 0\.55; cursor: default; \}/u,
  );
  assert.match(state, /className='dsh-editor-log-retry'/u);
  assert.match(client, /dsh-editor-log-retry \{ display: inline-flex/u);
});

test('Retry loading text remains localized and guarded', async () => {
  const state = await read('src/client/components/commit/CommitLogListState.tsx');

  assert.match(state, /aria-disabled=\{loading \? true : undefined\}/u);
  assert.match(state, /if \(!loading\) onRetry\?\.\(\)/u);
  assert.match(state, /loading \? t\('editor\.loading'\) : t\('editor\.logRetry'\)/u);
});
