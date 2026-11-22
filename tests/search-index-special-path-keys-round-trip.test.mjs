import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('a valid file named __proto__ round-trips through the persisted search index', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-special-path-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-special-path-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, '0-first.ts'), 'ordinary first file\n', 'utf8');
  await writeFile(join(root, '__proto__'), 'SPECIAL_PATH_KEY_NEEDLE\n', 'utf8');

  const rebuilt = await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(rebuilt.files, 2);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 2);

  const text = await searchWorkspaceText(root, 'SPECIAL_PATH_KEY_NEEDLE', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    text.matches.map((match) => match.path),
    ['__proto__'],
  );

  // A fresh module instance proves the name is on disk, not only in the rebuild's memory.
  const freshHost = await import(
    new URL(`../lib/index.js?special-path=${Date.now()}`, import.meta.url)
  );
  const names = await freshHost.workspaceFileOperations.search(root, 'proto', {
    maxVisited: 1,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    names.entries.map((entry) => entry.path),
    ['__proto__'],
  );
});
