import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  clearWorkspaceSearchIndex,
  searchWorkspaceText,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('project search cache persists, reuses unchanged files and refreshes changed files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-search-index-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'cache needle a\n', 'utf8');
  await writeFile(join(root, 'b.txt'), 'cache needle b\n', 'utf8');

  const first = await searchWorkspaceText(root, 'cache needle', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(first.matches.length, 2);
  assert.equal(first.indexCache.misses, 2);
  assert.equal(first.indexCache.hits, 0);
  assert.equal(first.indexCache.saved, true);

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, true);
  assert.ok(status.files >= 2);
  const firstUpdatedAt = status.updatedAt;

  const second = await searchWorkspaceText(root, 'cache needle', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(second.matches.length, 2);
  assert.equal(second.indexCache.hits, 2);
  assert.equal(second.indexCache.misses, 0);
  assert.equal(second.indexCache.saved, false);
  const statusAfterCachedSearch = await workspaceSearchIndexStatus(root, {
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(statusAfterCachedSearch.updatedAt, firstUpdatedAt);

  await writeFile(join(root, 'b.txt'), 'cache changed without the phrase\n', 'utf8');
  const refreshed = await searchWorkspaceText(root, 'cache needle', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    refreshed.matches.map((match) => match.path),
    ['a.txt'],
  );
  assert.equal(refreshed.indexCache.hits, 1);
  assert.equal(refreshed.indexCache.misses, 1);
  assert.equal(refreshed.indexCache.saved, true);

  const original = await stat(join(root, 'b.txt'));
  await workspaceFileOperations.write(root, 'b.txt', 'cache needle updated locally\n', original.mtimeMs, true, false);
  await utimes(join(root, 'b.txt'), original.atime, original.mtime);
  const invalidated = await searchWorkspaceText(root, 'updated locally', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    invalidated.matches.map((match) => match.path),
    ['b.txt'],
  );
  assert.equal(invalidated.indexCache.misses, 1);

  const cleared = await clearWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(cleared.cleared, true);
  const afterClear = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(afterClear.exists, false);
});
