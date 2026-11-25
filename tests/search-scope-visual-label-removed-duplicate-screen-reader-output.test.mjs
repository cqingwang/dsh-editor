import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('scope visual label is removed from duplicate screen-reader output', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');

  assert.match(toolbar, /className='dsh-editor-graph-scope-label'[\s\S]*?aria-hidden='true'/u);
  assert.match(toolbar, /role='group'[\s\S]*?aria-label=\{t\('editor\.graphAtChip'/u);
});

test('scope establishment and clear each produce one polite announcement', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const locales = await read('src/client/locales.ts');
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(toolbar, /role='status'/u);
  assert.match(toolbar, /aria-live='polite'/u);
  assert.match(toolbar, /aria-atomic='true'/u);
  assert.match(toolbar, /commitLogScopeAnnouncement\(t, scopeHash, previous\)/u);
  assert.match(toolbar, /if \(announcement === null\) return;/u);
  assert.match(locales, /graphScopeAnnouncement: '提交图已限定为提交 \{hash\} 的历史'/u);
  assert.match(locales, /graphScopeClearedAnnouncement: '已清除提交图的标签范围'/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-visually-hidden \{ position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect\(0, 0, 0, 0\) !important; white-space: nowrap !important; border: 0 !important; \}/u,
  );
});

test('scope announcement markup is present in the built client', async () => {
  const client = await read('lib/client.js');

  assert.match(client, /dsh-editor-visually-hidden/u);
  assert.match(client, /graphScopeAnnouncement/u);
  assert.match(client, /graphScopeClearedAnnouncement/u);
});
