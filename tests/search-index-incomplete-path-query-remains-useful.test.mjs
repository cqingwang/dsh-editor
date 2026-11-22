import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  WorkspaceWatcher,
  searchIndexIdentity,
  workspaceFileOperations,
  writeWorkspaceSearchIndex,
} from '../lib/index.js';

test('an incomplete persisted path snapshot still serves partial typed queries', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-incomplete-path-query-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-incomplete-path-query-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));

  const relativePath = 'packages/deep/src/Application.java';
  await mkdir(join(root, 'packages/deep/src'), { recursive: true });
  await writeFile(join(root, relativePath), 'class Application {}\n', 'utf8');
  const identity = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  await writeWorkspaceSearchIndex(identity, {
    version: 2,
    root: identity.root,
    updatedAt: 1,
    contentBytes: 21,
    files: {
      [relativePath]: {
        mtimeMs: 1,
        size: 21,
        content: 'class Application {}\n',
      },
    },
    directories: new Set(['packages', 'packages/deep', 'packages/deep/src']),
    pathScanComplete: false,
    directoryScanComplete: false,
    contentScanVerified: false,
    scopeSignature: JSON.stringify({ excluded: [], included: [] }),
    pathTruncated: false,
    contentTruncated: true,
    truncated: true,
  });
  const watcher = new WorkspaceWatcher(root, () => {});
  watcher.start();
  t.after(() => watcher.close());
  await new Promise((resolve) => setTimeout(resolve, 100));

  const result = await workspaceFileOperations.search(root, 'application.java', {
    showHidden: true,
    showExcluded: false,
    sort: 'name',
    foldersFirst: false,
    respectGitIgnore: true,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    searchIndexDirectory: indexDirectory,
    searchIndex: true,
    matchPath: true,
    filesOnly: true,
    maxVisited: 1,
    searchSessionId: 'incomplete-path-query',
    searchRevision: 0,
  });

  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    [relativePath],
  );
  assert.equal(result.truncated, true);

  const listing = await workspaceFileOperations.files(root, 1, {
    respectGitIgnore: true,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    searchIndexDirectory: indexDirectory,
    searchIndex: true,
  });
  assert.deepEqual(listing.files, [relativePath]);
  assert.equal(listing.truncated, true);
  assert.equal(listing.indexFastPath, true);
  assert.equal(listing.scopeComplete, false);
});
