import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('indexed filename search does not return a file deleted outside the Editor host', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-deleted-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-deleted-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'nested'), { recursive: true });
  const target = join(root, 'nested', 'EXTERNALLY_DELETED_TARGET.ts');
  await writeFile(target, 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  await rm(target);

  const result = await workspaceFileOperations.search(root, 'EXTERNALLY_DELETED_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(
    result.entries.some((entry) => entry.path === 'nested/EXTERNALLY_DELETED_TARGET.ts'),
    false,
  );
  const repeated = await workspaceFileOperations.search(root, 'EXTERNALLY_DELETED_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(
    repeated.entries.some((entry) => entry.path === 'nested/EXTERNALLY_DELETED_TARGET.ts'),
    false,
  );
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 0);
});
