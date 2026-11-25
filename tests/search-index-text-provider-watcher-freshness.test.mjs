import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  replaceWorkspaceText,
  searchWorkspaceText,
  WorkspaceWatcher,
  workspaceFileOperations,
} from '../lib/index.js';

test('a watcher-verified rebuild skips per-file stat for cached content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-cache-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-cache-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'WATCHER_CACHE_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'WATCHER_CACHE_NEEDLE beta\n', 'utf8');
  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const cached = await searchWorkspaceText(root, 'WATCHER_CACHE_NEEDLE', request);
  assert.equal(cached.indexFastPath, true);
  assert.equal(cached.indexCache.hits, 2);
  assert.equal(cached.indexCache.skippedStats, 2);

  await writeFile(join(root, 'alpha.ts'), 'WATCHER_CACHE_CHANGED alpha\n', 'utf8');
  watcher.record('', 'alpha.ts');
  const refreshed = await searchWorkspaceText(root, 'WATCHER_CACHE_CHANGED', request);
  assert.notEqual(refreshed.indexFastPath, true);
  assert.equal(refreshed.indexCache.skippedStats, 0);
  assert.deepEqual(
    refreshed.matches.map((match) => match.path),
    ['alpha.ts'],
  );

  const verifiedAgain = await searchWorkspaceText(root, 'WATCHER_CACHE_CHANGED', request);
  assert.equal(verifiedAgain.indexFastPath, true);
  assert.equal(verifiedAgain.indexCache.skippedStats, 2);
  assert.deepEqual(
    verifiedAgain.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});

test('a fresh process validates cached content once before skipping stat', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-restart-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-restart-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'RESTART_CACHE_ORDINARY alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'RESTART_CACHE_ORDINARY beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(new URL(`../lib/index.js?text-watcher-restart=${Date.now()}`, import.meta.url));
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const first = await freshHost.searchWorkspaceText(root, 'NO_MATCH_AFTER_RESTART', request);
  assert.equal(first.indexFastPath, true);
  assert.equal(first.indexCache.skippedStats, 0);
  assert.equal(first.indexCache.hits, 2);

  const second = await freshHost.searchWorkspaceText(root, 'NO_MATCH_AFTER_RESTART', request);
  assert.equal(second.indexFastPath, true);
  assert.equal(second.indexCache.skippedStats, 2);
});

test('an incomplete cached scan does not establish watcher freshness', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-cap-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-cap-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'CAPPED_CACHE_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'CAPPED_CACHE_NEEDLE beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(new URL(`../lib/index.js?text-watcher-cap=${Date.now()}`, import.meta.url));
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const capped = await freshHost.searchWorkspaceText(root, 'CAPPED_CACHE_NEEDLE', {
    ...request,
    maxMatches: 1,
  });
  assert.equal(capped.indexFastPath, true);
  assert.equal(capped.indexCache.skippedStats, 0);
  assert.equal(capped.matches.length, 1);

  const validated = await freshHost.searchWorkspaceText(root, 'NO_CAP_MATCH', request);
  assert.equal(validated.indexCache.skippedStats, 0);
  const cached = await freshHost.searchWorkspaceText(root, 'NO_CAP_MATCH', request);
  assert.equal(cached.indexCache.skippedStats, 2);
});

test('a Host write invalidates watcher-verified cached content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-write-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-write-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'alpha.ts');
  await writeFile(file, 'HOST_WRITE_OLD\n', 'utf8');
  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const info = await stat(file);
  await workspaceFileOperations.write(root, 'alpha.ts', 'HOST_WRITE_NEW\n', info.mtimeMs, true, false);
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const result = await searchWorkspaceText(root, 'HOST_WRITE_NEW', request);
  assert.equal(result.indexFastPath, true);
  assert.equal(result.indexCache.skippedStats, 0);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});

test('Replace in Files invalidates watcher-verified cached content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-replace-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-replace-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'alpha.ts');
  await writeFile(file, 'REPLACE_INDEX_OLD\n', 'utf8');
  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const before = await searchWorkspaceText(root, 'REPLACE_INDEX_OLD', request);
  assert.equal(before.indexFastPath, true);
  assert.equal(before.indexCache.skippedStats, 1);

  const info = await stat(file);
  await replaceWorkspaceText(root, 'REPLACE_INDEX_OLD', 'REPLACE_INDEX_NEW', [
    { path: 'alpha.ts', mtime: info.mtimeMs },
  ]);
  const after = await searchWorkspaceText(root, 'REPLACE_INDEX_NEW', request);
  assert.equal(after.indexFastPath, true);
  assert.equal(after.indexCache.skippedStats, 0);
  assert.deepEqual(
    after.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});

test('Git metadata churn does not revoke watcher-verified search content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-git-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-git-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'GIT_METADATA_NEEDLE alpha\n', 'utf8');
  const freshHost = await import(new URL(`../lib/index.js?text-watcher-git=${Date.now()}`, import.meta.url));
  let fireWatcher = null;
  const watcher = new freshHost.WorkspaceWatcher(root, () => {}, {
    watchImpl(_path, options, callback) {
      if (options?.recursive === true) fireWatcher = callback;
      return { close() {}, on() {} };
    },
  });
  t.after(() => watcher.close());
  watcher.start();
  await freshHost.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const status = () => freshHost.workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal((await status()).contentScanVerified, true);

  fireWatcher('rename', 'packages/plugin/.git/index.lock');
  fireWatcher('rename', 'packages/plugin/.git/modules/sdk/index.lock');
  fireWatcher('rename', 'packages/plugin/.git/index');
  fireWatcher('rename', '.git/index');
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal((await status()).contentScanVerified, true);
  const cached = await freshHost.searchWorkspaceText(root, 'GIT_METADATA_NEEDLE', request);
  assert.equal(cached.indexFastPath, true);
  assert.equal(cached.indexCache.hits, 1);

  fireWatcher('change', 'alpha.ts');
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal((await status()).contentScanVerified, false);
});

test('a budget-skipped stale cache entry is not promoted to watcher freshness', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-budget-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-watcher-budget-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'BUDGET_OLD_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'ordinary beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(new URL(`../lib/index.js?text-watcher-budget=${Date.now()}`, import.meta.url));
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  await writeFile(join(root, 'alpha.ts'), `BUDGET_NEW_NEEDLE ${'x'.repeat(64)}\n`, 'utf8');
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  await freshHost.searchWorkspaceText(root, 'NO_SMALL_BUDGET_MATCH', {
    ...request,
    maxBytes: 1,
  });
  const result = await freshHost.searchWorkspaceText(root, 'BUDGET_NEW_NEEDLE', request);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});
