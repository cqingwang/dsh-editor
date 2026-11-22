import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, workspaceFileOperations } from '../lib/index.js';

test('persisted paths extend filename and directory search beyond the live traversal budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-names-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-names-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'deep-folder', 'nested'), { recursive: true });
  await writeFile(join(root, 'deep-folder', 'nested', 'INDEXED_NAME_TARGET.ts'), 'export {};\n', 'utf8');
  await writeFile(join(root, '.hidden-indexed-name.ts'), 'export {};\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const file = await workspaceFileOperations.search(root, 'INDEXED_NAME_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.deepEqual(
    file.entries.map((entry) => [entry.path, entry.kind]),
    [['deep-folder/nested/INDEXED_NAME_TARGET.ts', 'file']],
  );

  const pathOnly = await workspaceFileOperations.search(root, 'nested/INDEXED_NAME', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
    matchPath: true,
  });
  assert.ok(pathOnly.entries.some((entry) => entry.path === 'deep-folder/nested/INDEXED_NAME_TARGET.ts'));

  const directory = await workspaceFileOperations.search(root, 'deep-folder', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.ok(directory.entries.some((entry) => entry.path === 'deep-folder' && entry.kind === 'directory'));

  const hidden = await workspaceFileOperations.search(root, 'hidden-indexed-name', {
    showHidden: false,
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(
    hidden.entries.some((entry) => entry.path === '.hidden-indexed-name.ts'),
    false,
  );

  await workspaceFileOperations.rename(
    root,
    'deep-folder/nested/INDEXED_NAME_TARGET.ts',
    'deep-folder/nested/RENAMED_INDEX_TARGET.ts',
  );
  const renamed = await workspaceFileOperations.search(root, 'RENAMED_INDEX_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.ok(renamed.entries.some((entry) => entry.path === 'deep-folder/nested/RENAMED_INDEX_TARGET.ts'));

  await workspaceFileOperations.remove(root, 'deep-folder/nested/RENAMED_INDEX_TARGET.ts');
  const deleted = await workspaceFileOperations.search(root, 'RENAMED_INDEX_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.equal(deleted.entries.some((entry) => entry.path === 'deep-folder/nested/RENAMED_INDEX_TARGET.ts'), false);
});
