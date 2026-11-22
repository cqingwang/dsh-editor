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

test('the persisted path index covers projects larger than the former 50,000-file cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-no-file-cap-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-no-file-cap-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 50_050;
  for (let start = 0; start < fileCount; start += 500) {
    await Promise.all(
      Array.from({ length: Math.min(500, fileCount - start) }, (_, offset) => {
        const index = start + offset;
        const name = index === fileCount - 1 ? 'application.java' : `source-${String(index).padStart(5, '0')}.java`;
        return writeFile(join(root, name), index === fileCount - 1 ? 'INDEX_AFTER_OLD_CAP\n' : 'class Source {}\n', 'utf8');
      }),
    );
  }

  const rebuilt = await rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    maxContentBytes: 1,
  });
  assert.equal(rebuilt.files, fileCount);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, fileCount);
  assert.equal(status.pathScanComplete, true);
  assert.equal(status.pathTruncated, false);

  let fireWatcher = null;
  const watcher = new WorkspaceWatcher(root, () => {}, {
    watchImpl(_path, options, callback) {
      if (options?.recursive === true) fireWatcher = callback;
      return { close() {}, on() {} };
    },
  });
  t.after(() => watcher.close());
  watcher.start();
  assert.equal(typeof fireWatcher, 'function');

  const result = await workspaceFileOperations.search(root, 'application.java', {
    showHidden: true,
    showExcluded: false,
    sort: 'name',
    foldersFirst: false,
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    filesOnly: true,
  });
  assert.deepEqual(result.entries.map((entry) => entry.path), ['application.java']);
  assert.equal(result.truncated, false);
});
