import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  WorkspaceWatcher,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('path queries search the compact persisted stream without losing literal punctuation or case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-path-query-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-path-query-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'Application.java'), 'class Application {}\n', 'utf8');
  await writeFile(join(root, 'application-notes.md'), 'Application.java reference\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const result = await workspaceFileOperations.search(root, 'application.java', {
    respectGitIgnore: true,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    filesOnly: true,
  });

  assert.equal(result.indexFastPath, true);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    ['Application.java'],
  );
});

test('broad path queries retain the bounded best matches without sorting every hit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-path-query-broad-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-path-query-broad-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 300 }, (_, index) =>
      writeFile(join(root, `a${String(index).padStart(3, '0')}.ts`), 'export {};\n', 'utf8'),
    ),
  );
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const result = await workspaceFileOperations.search(root, 'a', {
    respectGitIgnore: true,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    filesOnly: true,
  });

  assert.equal(result.indexFastPath, true);
  assert.equal(result.truncated, true);
  assert.equal(result.entries.length, 200);
  assert.equal(result.entries[0].path, 'a000.ts');
  assert.equal(result.entries[199].path, 'a199.ts');
});

test('known binary extensions stay filename-searchable but do not enter text scans', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-binary-extension-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-binary-extension-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'diagram.png'), `BINARY_EXTENSION_NEEDLE\n${'x'.repeat(200)}`, 'utf8');
  await writeFile(join(root, 'notes.ts'), 'BINARY_EXTENSION_NEEDLE\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    maxContentBytes: 64,
  });
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.ok(status.contentBytes > 0, 'known binary files must not exhaust the text cache budget');

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const text = await workspaceFileOperations.searchText(root, 'BINARY_EXTENSION_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(
    text.matches.map((match) => match.path),
    ['notes.ts'],
  );

  const files = await workspaceFileOperations.search(root, 'diagram', {
    respectGitIgnore: true,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    filesOnly: true,
  });
  assert.deepEqual(
    files.entries.map((entry) => entry.path),
    ['diagram.png'],
  );
});

test('repeated indexed text searches reuse the completed query cache until the workspace changes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-query-cache-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-query-cache-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'alpha.ts');
  await writeFile(file, 'CACHE_NEEDLE alpha\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const options = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'query-cache',
    searchRevision: 1,
    maxMatches: 20,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  const first = await workspaceFileOperations.searchText(root, 'CACHE_NEEDLE', options);
  assert.equal(first.matches.length, 1);
  assert.notEqual(first.indexCache.queryCacheHit, true);

  const second = await workspaceFileOperations.searchText(root, 'CACHE_NEEDLE', options);
  assert.equal(second.matches.length, 1);
  assert.equal(second.indexCache.queryCacheHit, true);

  await workspaceFileOperations.write(root, 'alpha.ts', 'no old needle remains\n', undefined, false, false);
  const changed = await workspaceFileOperations.searchText(root, 'CACHE_NEEDLE', options);
  assert.equal(changed.matches.length, 0);
  assert.notEqual(changed.indexCache.queryCacheHit, true);
});
