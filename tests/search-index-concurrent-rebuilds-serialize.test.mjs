import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, workspaceSearchIndexStatus } from '../lib/index.js';

test('a queued rebuild cannot be invalidated by an earlier aborted rebuild', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-rebuild-serialize-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-rebuild-serialize-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 20;
  await Promise.all(
    Array.from({ length: fileCount }, (_, index) =>
      writeFile(join(root, `queued-${String(index).padStart(2, '0')}.ts`), 'export const value = true;\n'),
    ),
  );

  const controller = new AbortController();
  controller.abort();
  const [aborted, completed] = await Promise.all([
    rebuildWorkspaceSearchIndex(root, {
      searchIndexDirectory: indexDirectory,
      signal: controller.signal,
    }),
    rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory }),
  ]);

  assert.equal(aborted.aborted, true);
  assert.equal(completed.files, fileCount);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, true);
  assert.equal(status.files, fileCount);
  assert.equal(status.rebuilding, false);
  assert.deepEqual(
    (await readdir(indexDirectory)).filter((name) => name.endsWith('.tmp')),
    [],
  );
});
