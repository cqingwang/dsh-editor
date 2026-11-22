import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('positive text results become reusable in a fresh Host process', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'PERSISTED_QUERY_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'notes.md'), 'ordinary text\n', 'utf8');

  const buildHost = await import(
    new URL(`../lib/index.js?persistent-query-build=${Date.now()}`, import.meta.url)
  );
  const buildWatcher = new buildHost.WorkspaceWatcher(root, () => {});
  t.after(() => buildWatcher.close());
  buildWatcher.start();
  await buildHost.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const identity = buildHost.searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  const first = await buildHost.workspaceFileOperations.searchText(root, 'PERSISTED_QUERY_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'first-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(first.matches.map((match) => match.path), ['alpha.ts']);
  assert.notEqual(first.indexCache.persistentQueryCacheHit, true);
  assert.notEqual(await stat(identity.queryCacheFile).catch(() => null), null);
  buildWatcher.close();

  const freshHost = await import(
    new URL(`../lib/index.js?persistent-query-read=${Date.now()}`, import.meta.url)
  );
  const freshWatcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => freshWatcher.close());
  freshWatcher.start();
  await freshHost.updateWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  const cached = await freshHost.workspaceFileOperations.searchText(root, 'PERSISTED_QUERY_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'another-browser-session',
    searchRevision: 99,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(cached.matches.map((match) => match.path), ['alpha.ts']);
  assert.equal(cached.indexCache.fastPersistentQueryCacheHit, true);
  assert.equal(cached.indexCache.persistentQueryCacheHit, undefined);
  assert.equal(cached.indexCache.queryCacheHit, undefined);
});

test('persistent query keys retain every option that changes the result set', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-options-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-options-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'OPTION_QUERY_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'alpha.md'), 'OPTION_QUERY_NEEDLE\n', 'utf8');

  const host = await import(
    new URL(`../lib/index.js?persistent-query-options=${Date.now()}`, import.meta.url)
  );
  await host.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const watcher = new host.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const options = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'options-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  await host.workspaceFileOperations.searchText(root, 'OPTION_QUERY_NEEDLE', options);
  const filtered = await host.workspaceFileOperations.searchText(root, 'OPTION_QUERY_NEEDLE', {
    ...options,
    fileMask: '*.md',
    searchRevision: 2,
  });
  assert.deepEqual(filtered.matches.map((match) => match.path), ['alpha.md']);
  assert.notEqual(filtered.indexCache.persistentQueryCacheHit, true);
});

test('workspace changes invalidate a persisted query and zero-result scans never create one', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-invalidate-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-invalidate-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'alpha.ts');
  await writeFile(file, 'INVALIDATED_QUERY_NEEDLE\n', 'utf8');

  const host = await import(
    new URL(`../lib/index.js?persistent-query-invalidate=${Date.now()}`, import.meta.url)
  );
  const watcher = new host.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  await host.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const identity = host.searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  const options = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'invalidate-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  await host.workspaceFileOperations.searchText(root, 'INVALIDATED_QUERY_NEEDLE', options);
  assert.notEqual(await stat(identity.queryCacheFile).catch(() => null), null);

  await writeFile(file, 'replacement content\n', 'utf8');
  watcher.record('', 'alpha.ts');
  const changed = await host.workspaceFileOperations.searchText(root, 'INVALIDATED_QUERY_NEEDLE', {
    ...options,
    searchRevision: 2,
  });
  assert.deepEqual(changed.matches, []);
  assert.notEqual(changed.indexCache.persistentQueryCacheHit, true);
  assert.notEqual(changed.indexCache.fastPersistentQueryCacheHit, true);

  await rm(identity.queryCacheFile, { force: true });
  const miss = await host.workspaceFileOperations.searchText(root, 'NEVER_PRESENT_QUERY_NEEDLE', {
    ...options,
    searchRevision: 3,
  });
  assert.deepEqual(miss.matches, []);
  assert.equal(await stat(identity.queryCacheFile).catch(() => null), null);
});

test('a completed query persists even when the content-cache byte budget is exhausted', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-budget-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-persistent-query-budget-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'BUDGETED_QUERY_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'ordinary beta\n', 'utf8');

  const host = await import(
    new URL(`../lib/index.js?persistent-query-budget=${Date.now()}`, import.meta.url)
  );
  const watcher = new host.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  await host.rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    maxContentBytes: 1,
  });
  const identity = host.searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  const result = await host.workspaceFileOperations.searchText(root, 'BUDGETED_QUERY_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'budget-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(result.matches.map((match) => match.path), ['alpha.ts']);
  assert.notEqual(await stat(identity.queryCacheFile).catch(() => null), null);
});
