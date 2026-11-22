import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, workspaceSearchIndexStatus } from '../lib/index.js';

test('status reports an incomplete rebuilding state before the fresh snapshot exists', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-status-progress-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-status-progress-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 300;
  await Promise.all(
    Array.from({ length: fileCount }, (_, index) =>
      writeFile(join(root, `status-${String(index).padStart(3, '0')}.ts`), 'export const value = true;\n'),
    ),
  );

  const rebuilding = rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const during = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(during.rebuilding, true);
  assert.equal(during.exists, false);
  assert.equal(during.files, 0);
  assert.equal(during.contentBytes, 0);
  assert.equal(during.pathScanComplete, false);
  assert.equal(during.directoryScanComplete, false);
  assert.equal(during.contentScanVerified, false);
  assert.equal(during.scopeSignature, '');

  const completed = await rebuilding;
  assert.equal(completed.files, fileCount);
  const after = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(after.rebuilding, false);
  assert.equal(after.exists, true);
  assert.equal(after.files, fileCount);
  assert.equal(after.processedFiles, fileCount);
  assert.equal(after.totalFiles, fileCount);
  assert.equal(after.pathScanComplete, true);
  assert.equal(after.directoryScanComplete, true);
  assert.equal(after.scopeSignature, '{"excluded":[],"included":[]}');
});
