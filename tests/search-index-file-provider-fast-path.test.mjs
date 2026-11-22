import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  WorkspaceWatcher,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('directory collection has an independent bounded budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-directory-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'alpha'));
  await mkdir(join(root, 'beta'));
  await mkdir(join(root, 'gamma'));
  await writeFile(join(root, 'target.ts'), 'export {};\n', 'utf8');

  const listing = await workspaceFileOperations.files(root, 10, {
    includeDirectories: true,
    directoryLimit: 2,
  });
  assert.equal(listing.truncated, false);
  assert.equal(listing.directories.length, 2);
  assert.equal(listing.directoriesTruncated, true);
  assert.deepEqual(listing.files, ['target.ts']);
});

test('a complete persisted path cache serves file-provider queries without a live walk', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-fast-path-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-fast-path-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'alpha\n', 'utf8');
  await writeFile(join(root, 'target-beta.ts'), 'beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?file-fast-path=${Date.now()}`, import.meta.url)
  );
  const request = {
    filesOnly: true,
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  };
  const withoutWatcher = await freshHost.workspaceFileOperations.search(root, 'target-beta', {
    ...request,
    maxVisited: 20,
  });
  assert.notEqual(withoutWatcher.indexFastPath, true);

  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const result = await freshHost.workspaceFileOperations.search(root, 'target-beta', request);
  assert.equal(result.indexFastPath, true);
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    ['target-beta.ts'],
  );
});

test('a watcher event or changed directory rules prevents the stale fast path', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-fast-path-stale-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-fast-path-stale-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'alpha\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  watcher.record('', 'alpha.ts');
  watcher.close();
  const afterWatcher = await workspaceFileOperations.search(root, 'alpha', {
    filesOnly: true,
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 20,
  });
  assert.notEqual(afterWatcher.indexFastPath, true);
  assert.deepEqual(
    afterWatcher.entries.map((entry) => entry.path),
    ['alpha.ts'],
  );

  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const scopeWatcher = new WorkspaceWatcher(root, () => {});
  t.after(() => scopeWatcher.close());
  const changedScope = await workspaceFileOperations.search(root, 'alpha', {
    filesOnly: true,
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchDirectoryRules: { excludedDirectories: ['docs'] },
    maxVisited: 20,
  });
  assert.notEqual(changedScope.indexFastPath, true);
  assert.deepEqual(
    changedScope.entries.map((entry) => entry.path),
    ['alpha.ts'],
  );
});

test('a complete directory snapshot keeps empty directories on the fast path', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-directory-fast-path-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-directory-fast-path-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'empty-directory'));
  await writeFile(join(root, 'ordinary.ts'), 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?directory-fast-path=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const result = await freshHost.workspaceFileOperations.search(root, 'empty-directory', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(result.indexFastPath, true);
  assert.deepEqual(
    result.entries.map((entry) => `${entry.kind}:${entry.path}`),
    ['directory:empty-directory'],
  );
});

test('a deleted directory is removed from the persisted path projection', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-directory-deleted-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-directory-deleted-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'deleted-directory'));
  await writeFile(join(root, 'keep.ts'), 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const before = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(before.directories, 1);

  await rm(join(root, 'deleted-directory'), { recursive: true });
  const watcher = new WorkspaceWatcher(root, () => {});
  watcher.record('', 'deleted-directory');
  const reconciled = await workspaceFileOperations.search(root, 'deleted-directory', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 20,
  });
  assert.notEqual(reconciled.indexFastPath, true);
  assert.deepEqual(reconciled.entries, []);
  const after = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(after.directories, 0);

  const cached = await workspaceFileOperations.search(root, 'deleted-directory', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(cached.indexFastPath, true);
  assert.deepEqual(cached.entries, []);
  watcher.close();
});
