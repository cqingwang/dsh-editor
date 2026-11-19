import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Escape clears the Commit Log filter while leaving the input mounted', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const escapeStart = toolbar.indexOf("if (event.key === 'Escape')");
  assert.notEqual(escapeStart, -1);
  const escapeBlock = toolbar.slice(escapeStart, toolbar.indexOf('}', escapeStart) + 1);

  assert.match(escapeBlock, /onFilterChange\(''\)/u);
  assert.doesNotMatch(escapeBlock, /onFilterVisibleChange\(false\)/u);
  assert.doesNotMatch(toolbar, /onFilterClosed/u);
  assert.doesNotMatch(log, /onFilterClosed=/u);
});
