import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('aborted Project speed search stops before walking the workspace', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-abort-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested', 'needle.txt'), '');

  const controller = new AbortController();
  controller.abort();
  const result = await workspaceFileOperations.search(root, 'needle', {
    signal: controller.signal,
  });

  assert.deepEqual(result, { entries: [], truncated: false });
});

test('Project speed search passes and aborts the request signal', () => {
  const effect = panelSource.slice(
    panelSource.indexOf('const query = search.trim();'),
    panelSource.indexOf('}, [filteredView, foldersFirst, search, showExcludedFiles, showHidden, sortMode]);'),
  );
  assert.match(effect, /const controller = new AbortController\(\)/u);
  assert.match(effect, /\{ signal: controller\.signal \},\s*\)/u);
  assert.match(effect, /controller\.abort\(\)/u);
});
