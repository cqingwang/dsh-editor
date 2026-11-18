import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph scope survives forced-colors with system colors', async () => {
  const injectedCss = await read('src/client/injected-css.ts');
  const client = await read('lib/client.js');

  assert.match(injectedCss, /@media \(forced-colors: active\) \{/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-log-scope \{ color: CanvasText !important; background: Canvas !important; border-color: CanvasText !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-scope-clear:focus-visible \{ outline-color: Highlight !important; \}/u,
  );
  assert.match(client, /@media \(forced-colors: active\)/u);
});

test('Graph scope opts out of motion when reduced motion is requested', async () => {
  const injectedCss = await read('src/client/injected-css.ts');
  const client = await read('lib/client.js');

  assert.match(injectedCss, /@media \(prefers-reduced-motion: reduce\) \{/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-log-toolbar, \.dsh-editor-log-scope, \.dsh-editor-graph-scope-clear \{ transition: none !important; animation: none !important; \}/u,
  );
  assert.match(client, /@media \(prefers-reduced-motion: reduce\)/u);
});
