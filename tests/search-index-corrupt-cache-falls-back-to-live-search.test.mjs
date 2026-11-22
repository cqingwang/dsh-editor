import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  searchIndexIdentity,
  searchWorkspaceText,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('a corrupt compressed index falls back to live search and is replaced', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-corrupt-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-corrupt-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'recover.ts'), 'corrupt-cache-needle\n', 'utf8');

  const identity = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  await mkdir(dirname(identity.file), { recursive: true });
  await writeFile(identity.file, 'not a gzip stream');

  const searched = await searchWorkspaceText(root, 'corrupt-cache-needle', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    searched.matches.map((match) => match.path),
    ['recover.ts'],
  );
  assert.equal(searched.indexCache.misses, 1);
  assert.equal(searched.indexCache.saved, true);

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.exists, true);
  assert.equal(status.files, 1);
});
