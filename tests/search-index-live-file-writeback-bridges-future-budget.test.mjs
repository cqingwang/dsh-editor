import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

import {
  rebuildWorkspaceSearchIndex,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

async function waitForPersistedPathIndex(indexDirectory, expected) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = await readdir(indexDirectory).catch(() => []);
    for (const indexFile of files.filter((name) => name.endsWith('.json.gz'))) {
      const content = gunzipSync(await readFile(join(indexDirectory, indexFile))).toString('utf8');
      if (content.includes(expected)) return content;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return '';
}

test('live-discovered paths are retained for later index-only filename queries', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-writeback-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-writeback-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'base.ts'), 'export const base = true;\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  await mkdir(join(root, 'nested'), { recursive: true });
  await writeFile(join(root, 'nested', 'NEW_LIVE_TARGET.ts'), 'export {};\n', 'utf8');
  const liveSearch = await workspaceFileOperations.search(root, 'base.ts', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.ok(liveSearch.entries.some((entry) => entry.path === 'base.ts'));

  const persisted = await waitForPersistedPathIndex(indexDirectory, 'nested/NEW_LIVE_TARGET.ts');
  assert.notEqual(persisted, '');
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 2);

  const fromIndex = await workspaceFileOperations.search(root, 'NEW_LIVE_TARGET', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.deepEqual(
    fromIndex.entries.map((entry) => entry.path),
    ['nested/NEW_LIVE_TARGET.ts'],
  );
});
