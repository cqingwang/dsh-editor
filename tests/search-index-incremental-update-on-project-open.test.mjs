import assert from 'node:assert/strict';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
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

test('project-open update reuses unchanged files and refreshes changed, added and removed paths', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));

  await writeFile(join(root, 'unchanged.ts'), 'export const stable = "unchanged-token";\n');
  await writeFile(join(root, 'changed.ts'), 'export const value = "before-token";\n');
  await writeFile(join(root, 'removed.ts'), 'export const removed = "removed-token";\n');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory });

  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeFile(join(root, 'changed.ts'), 'export const value = "after-token";\n');
  await writeFile(join(root, 'added.ts'), 'export const added = "added-token";\n');
  await unlink(join(root, 'removed.ts'));

  const updated = await updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(updated.changedFiles, 2);
  assert.equal(updated.reusedFiles, 1);
  assert.equal(updated.removedFiles, 1);
  assert.equal(updated.files, 3);
  assert.equal(updated.truncated, false);

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(status.exists, true);
  assert.equal(status.rebuilding, false);
  assert.equal(status.files, 3);
  assert.equal(status.pathScanComplete, true);
  assert.equal(status.directoryScanComplete, true);
  assert.equal(status.truncated, false);

  const changedSearch = await searchWorkspaceText(root, 'after-token', {
    searchIndex: true,
    searchIndexDirectory,
    includeExcluded: false,
  });
  assert.deepEqual(
    changedSearch.matches.map((match) => match.path),
    ['changed.ts'],
  );
  const removedSearch = await searchWorkspaceText(root, 'removed-token', {
    searchIndex: true,
    searchIndexDirectory,
    includeExcluded: false,
  });
  assert.deepEqual(removedSearch.matches, []);
});

test('project-open update builds a missing index through the same operation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-missing-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-missing-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'first.ts'), 'export const first = "first-token";\n');

  const summary = await updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(summary.files, 1);
  assert.equal(summary.truncated, false);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(status.exists, true);
  assert.equal(status.pathScanComplete, true);
  assert.equal(status.directoryScanComplete, true);
});

test('a watcher-verified index is not scanned again when another project surface opens', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-verified-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-update-verified-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'stable.ts'), 'export const stable = "stable-token";\n');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory });

  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const verified = await updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(verified.changedFiles, 0);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(status.contentScanVerified, true);

  const reopened = await updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(reopened.unchanged, true);
  assert.equal(reopened.changedFiles, 0);
});
