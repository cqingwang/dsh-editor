import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph ref badges expose action names and bounded text overflow', async () => {
  const row = await read('src/client/components/commit/CommitGraphRow.tsx');
  const styles = await read('src/client/ui/styles.ts');
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(row, /className='dsh-editor-graph-ref'/u);
  assert.match(row, /aria-label=\{t\('editor\.graphFilterByRef'/u);
  assert.match(row, /title=\{t\('editor\.graphFilterByRef'/u);
  assert.match(styles, /commitGraphRef: \{[\s\S]*?maxWidth: '100%'[\s\S]*?textOverflow: 'ellipsis'/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-ref \{ display: inline-block !important; min-width: 0 !important; max-width: 100% !important; overflow: hidden !important; text-overflow: ellipsis !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-graph-ref:focus-visible \{ outline: 1px solid var\(--dsw-alias-state-business-primary\); outline-offset: 1px; \}/u,
  );
});

test('Graph ref badge behavior remains inside CommitGraphRow', async () => {
  const row = await read('src/client/components/commit/CommitGraphRow.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(row, /onClick=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onPickRef\?\.\(ref\)/u);
  assert.match(build, /CommitGraphRow\.tsx/u);
  assert.match(client, /dsh-editor-graph-ref:focus-visible/u);
});
