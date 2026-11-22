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

test('a rebuild keeps later paths searchable after the content budget is exhausted', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-content-budget-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-content-budget-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'a.ts'), `${'a'.repeat(700)}\n`, 'utf8');
  await writeFile(join(root, 'b.ts'), `${'b'.repeat(700)}\n`, 'utf8');
  await writeFile(join(root, 'GAMMA_UNIQUE_NAME.ts'), `later-content-needle\n${'c'.repeat(700)}\n`, 'utf8');

  const rebuilt = await rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    maxContentBytes: 1024,
  });
  assert.equal(rebuilt.files, 3);
  assert.equal(rebuilt.truncated, true);
  assert.ok(rebuilt.skippedFiles >= 2);

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 3);

  const filenameHits = await workspaceFileOperations.search(root, 'GAMMA_UNIQUE_NAME', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
  });
  assert.ok(filenameHits.entries.some((entry) => entry.path === 'GAMMA_UNIQUE_NAME.ts'));

  const textHits = await searchWorkspaceText(root, 'later-content-needle', {
    maxMatches: 20,
    maxBytes: 4096,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    textHits.matches.map((match) => match.path),
    ['GAMMA_UNIQUE_NAME.ts'],
  );

  const cachedAgain = await searchWorkspaceText(root, 'later-content-needle', {
    maxMatches: 20,
    maxBytes: 4096,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    cachedAgain.matches.map((match) => match.path),
    ['GAMMA_UNIQUE_NAME.ts'],
  );
  assert.equal(cachedAgain.indexCache.misses, 0);
  assert.ok(cachedAgain.indexCache.hits >= 3);
});
