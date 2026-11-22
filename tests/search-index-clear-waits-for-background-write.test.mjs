import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  clearWorkspaceSearchIndex,
  rebuildWorkspaceSearchIndex,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('clear waits for a queued index write and cannot be resurrected afterwards', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-write-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-write-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'base.ts'), 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  await writeFile(join(root, 'LIVE_AFTER_INDEX.ts'), 'export {};\n', 'utf8');
  await workspaceFileOperations.search(root, 'base.ts', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  const cleared = await clearWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(cleared.cleared, true);

  await new Promise((resolve) => setTimeout(resolve, 50));
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, false);
  assert.deepEqual(
    (await readdir(indexDirectory)).filter((name) => name.endsWith('.json.gz')),
    [],
  );
});

test('an aborted clear leaves the existing index intact', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-abort-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-abort-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'base.ts'), 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const controller = new AbortController();
  controller.abort();
  const cleared = await clearWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    signal: controller.signal,
  });
  assert.equal(cleared.aborted, true);
  assert.equal(cleared.cleared, false);

  const files = (await readdir(indexDirectory)).filter((name) => name.endsWith('.json.gz'));
  assert.equal(files.length, 1);
  assert.equal((await stat(join(indexDirectory, files[0]))).size > 0, true);
});
