import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchWorkspaceText } from '../lib/index.js';

test('an exhausted disk budget does not hide later files already served from cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-budget-cache-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-budget-cache-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'z-target.ts'), 'CACHED_AFTER_BUDGET_NEEDLE\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  await writeFile(join(root, 'a-new.ts'), `ordinary ${'a'.repeat(4096)}\n`, 'utf8');
  await writeFile(join(root, 'b-new.ts'), `ordinary ${'b'.repeat(4096)}\n`, 'utf8');

  const result = await searchWorkspaceText(root, 'CACHED_AFTER_BUDGET_NEEDLE', {
    maxMatches: 20,
    maxBytes: 100,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['z-target.ts'],
  );
  assert.equal(result.indexCache.hits, 1);
});

test('after skipping an over-budget file, smaller uncached files can still be read', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-budget-small-later-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a-large.ts'), `ordinary ${'x'.repeat(4096)}\n`, 'utf8');
  await writeFile(join(root, 'b-small.ts'), 'SMALL_LATER_NEEDLE\n', 'utf8');

  const result = await searchWorkspaceText(root, 'SMALL_LATER_NEEDLE', {
    maxMatches: 20,
    maxBytes: 64,
    searchIndex: false,
  });
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['b-small.ts'],
  );
  assert.ok(result.scannedBytes <= 64);
});

test('a tiny disk budget does not truncate a query fully served from cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-budget-all-cache-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-budget-all-cache-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'a.ts'), 'ALL_CACHE_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'b.ts'), 'ALL_CACHE_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'c.ts'), 'ALL_CACHE_NEEDLE\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const result = await searchWorkspaceText(root, 'ALL_CACHE_NEEDLE', {
    maxMatches: 20,
    maxBytes: 1,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(result.truncated, false);
  assert.equal(result.scannedBytes, 0);
  assert.equal(result.indexCache.hits, 3);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['a.ts', 'b.ts', 'c.ts'],
  );
});
