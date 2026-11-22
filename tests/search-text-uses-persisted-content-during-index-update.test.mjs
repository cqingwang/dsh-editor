import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  updateWorkspaceSearchIndex,
  WorkspaceWatcher,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('text search uses the persisted content snapshot while an incremental update is running', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-search-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-search-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  const fileCount = 5_000;
  for (let start = 0; start < fileCount; start += 500) {
    await Promise.all(
      Array.from({ length: Math.min(500, fileCount - start) }, (_, offset) => {
        const index = start + offset;
        return writeFile(
          join(root, 'src', `file-${String(index).padStart(4, '0')}.ts`),
          index === fileCount - 1 ? 'export const marker = "INDEX_UPDATE_MARKER";\n' : 'export const value = 1;\n',
          'utf8',
        );
      }),
    );
  }
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const update = updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  let status = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    status = await workspaceSearchIndexStatus(root, { searchIndexDirectory });
    if (status.rebuilding === true) break;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.equal(status?.rebuilding, true);

  const result = await searchWorkspaceText(root, 'INDEX_UPDATE_MARKER', {
    searchIndex: true,
    searchIndexDirectory,
    includeExcluded: false,
  });
  assert.deepEqual(
    result.matches.map(({ path, line, column, preview }) => ({ path, line, column, preview })),
    [
      {
        path: `src/file-${String(fileCount - 1).padStart(4, '0')}.ts`,
        line: 1,
        column: 24,
        preview: 'export const marker = "INDEX_UPDATE_MARKER";',
      },
    ],
  );
  assert.equal(result.truncated, true);
  await update;
});

test('project index status arms immediate stale-safe text search before verification finishes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-status-search-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-status-search-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'INDEX_STATUS_MARKER alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'INDEX_STATUS_MARKER beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?index-status-search=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const status = await freshHost.workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(status.contentScanVerified, false);
  const result = await freshHost.searchWorkspaceText(root, 'INDEX_STATUS_MARKER', {
    searchIndex: true,
    searchIndexDirectory,
    includeExcluded: false,
  });
  assert.equal(result.truncated, true);
  assert.equal(result.indexCache.skippedStats, 2);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['alpha.ts', 'beta.ts'],
  );
});
