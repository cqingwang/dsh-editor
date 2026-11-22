import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, workspaceSearchIndexStatus } from '../lib/index.js';

test('rebuild yields while retaining path-only files so cancellation can be observed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-tail-cancel-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-tail-cancel-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 2048;
  for (let start = 0; start < fileCount; start += 256) {
    await Promise.all(
      Array.from({ length: Math.min(256, fileCount - start) }, (_, offset) =>
        writeFile(
          join(root, `tail-${String(start + offset).padStart(5, '0')}.ts`),
          'export const value = true;\n',
        ),
      ),
    );
  }

  const controller = new AbortController();
  const rebuilding = rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    maxContentBytes: 1,
    signal: controller.signal,
  });
  let observedIntermediateProgress = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
    if (status.processedFiles > 0 && status.processedFiles < fileCount) {
      observedIntermediateProgress = true;
      controller.abort();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const result = await rebuilding;

  assert.equal(observedIntermediateProgress, true);
  assert.equal(result.aborted, true);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, false);
  assert.deepEqual(
    (await readdir(indexDirectory)).filter((name) => name.endsWith('.tmp')),
    [],
  );
});
