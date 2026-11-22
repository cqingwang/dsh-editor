import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchWorkspaceText, workspaceSearchIndexStatus } from '../lib/index.js';

test('a rebuilt project index searches files beyond the live 2000-file enumeration cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-large-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-large-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 2050;
  await Promise.all(
    Array.from({ length: fileCount }, (_, index) =>
      writeFile(
        join(root, `file-${String(index).padStart(4, '0')}.txt`),
        index === fileCount - 1 ? 'INDEX_BEYOND_LIVE_CAP_NEEDLE\n' : 'ordinary indexed content\n',
        'utf8',
      ),
    ),
  );

  const rebuilt = await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(rebuilt.files, fileCount);
  assert.equal(rebuilt.truncated, false);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.rebuilding, false);
  assert.equal(status.processedFiles, fileCount);
  assert.equal(status.totalFiles, fileCount);
  assert.ok(status.generation > 0);

  const result = await searchWorkspaceText(root, 'INDEX_BEYOND_LIVE_CAP_NEEDLE', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });

  assert.deepEqual(
    result.matches.map((match) => match.path),
    [`file-${String(fileCount - 1).padStart(4, '0')}.txt`],
  );
  assert.equal(result.indexCache.hits, fileCount);
  assert.equal(result.indexCache.misses, 0);
});

test('aborting a rebuild preserves the previous index instead of replacing it with empty data', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-abort-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-abort-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'kept.ts'), 'ABORTED_REBUILD_KEEPS_OLD_INDEX\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const controller = new AbortController();
  controller.abort();
  const aborted = await rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    signal: controller.signal,
  });
  assert.equal(aborted.aborted, true);

  const result = await searchWorkspaceText(root, 'ABORTED_REBUILD_KEEPS_OLD_INDEX', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['kept.ts'],
  );
});
