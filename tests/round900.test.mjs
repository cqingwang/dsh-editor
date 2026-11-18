import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('scope clear exposes a stable pointer target and title', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(toolbar, /aria-label=\{t\('editor\.graphClearScope'\)\}/u);
  assert.match(toolbar, /title=\{t\('editor\.graphClearScope'\)\}/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear \{ display: inline-flex; align-items: center; justify-content: center; min-width: 16px; min-height: 16px; padding: 0 !important; border-radius: 3px; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:hover \{ background: var\(--dsw-alias-interactive-bg-hover\); color: var\(--dsw-alias-label-primary\); \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:active \{ background: var\(--dsw-alias-button-ghost-active-fill\); \}/u,
  );
});

test('forced-colors provides distinct hover and pressed feedback', async () => {
  const injectedCss = await read('src/client/injected-css.ts');
  const client = await read('lib/client.js');

  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:hover \{ background: ButtonFace !important; color: ButtonText !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:active \{ background: Highlight !important; color: HighlightText !important; \}/u,
  );
  assert.match(client, /dsh-editor-graph-scope-clear:hover/u);
  assert.match(client, /dsh-editor-graph-scope-clear:active/u);
});
