import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex } from '../lib/index.js';

test('cold text-cache validation prefetches metadata in bounded batches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-stat-prefetch-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-stat-prefetch-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 64 }, (_, index) =>
      writeFile(
        join(root, `file-${String(index).padStart(3, '0')}.ts`),
        'export const ordinaryValue = 1;\n',
        'utf8',
      ),
    ),
  );
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?text-stat-prefetch=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const request = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'prefetch-page',
    searchRevision: 1,
  };
  const first = await freshHost.searchWorkspaceText(root, 'NO_PREFETCH_MATCH', request);
  assert.equal(first.indexFastPath, true);
  assert.equal(first.indexCache.hits, 64);
  assert.equal(first.indexCache.skippedStats, 0);
  assert.equal(first.indexCache.prefetchedStats, 64);

  const second = await freshHost.searchWorkspaceText(root, 'NO_PREFETCH_MATCH', request);
  assert.equal(second.indexCache.skippedStats, 64);
  assert.equal(second.indexCache.prefetchedStats, 0);
});

test('a match cap discards no more than one prefetched metadata batch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-stat-prefetch-cap-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-stat-prefetch-cap-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 128 }, (_, index) =>
      writeFile(
        join(root, `file-${String(index).padStart(3, '0')}.ts`),
        'PREFETCH_CAP_NEEDLE\n',
        'utf8',
      ),
    ),
  );
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?text-stat-prefetch-cap=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const result = await freshHost.searchWorkspaceText(root, 'PREFETCH_CAP_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'prefetch-cap-page',
    searchRevision: 1,
    maxMatches: 1,
  });
  assert.equal(result.matches.length, 1);
  assert.equal(result.indexCache.prefetchedStats, 64);
});
