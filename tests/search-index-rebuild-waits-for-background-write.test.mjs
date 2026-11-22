import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

import {
  rebuildWorkspaceSearchIndex,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

async function persistedIndex(indexDirectory) {
  const files = await readdir(indexDirectory).catch(() => []);
  const indexFile = files.find((name) => name.endsWith('.json.gz'));
  return indexFile === undefined
    ? ''
    : gunzipSync(await readFile(join(indexDirectory, indexFile))).toString('utf8');
}

test('rebuild waits for a queued background write and persists the fresh snapshot', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-rebuild-write-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-rebuild-write-store-'));
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
  const rebuilt = await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(rebuilt.files, 2);

  await new Promise((resolve) => setTimeout(resolve, 50));
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, true);
  assert.equal(status.files, 2);
  const content = await persistedIndex(indexDirectory);
  assert.match(content, /base\.ts/u);
  assert.match(content, /LIVE_AFTER_INDEX\.ts/u);
});
