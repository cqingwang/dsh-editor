import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  WorkspaceWatcher,
} from '../lib/index.js';

test('literal text search discovers indexed candidates without reading every unrelated file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-grep-candidate-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-grep-candidate-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));

  for (let index = 0; index < 600; index += 1) {
    const isMatch = index === 7 || index === 53;
    await writeFile(
      join(root, `source-${String(index).padStart(3, '0')}.${index % 2 === 0 ? 'ts' : 'md'}`),
      isMatch ? `CANDIDATE_NEEDLE ${index}\n` : `unrelated payload ${index}\n`,
      'utf8',
    );
  }
  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const options = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'grep-candidate-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  const matched = await searchWorkspaceText(root, 'CANDIDATE_NEEDLE', {
    ...options,
    maxMatches: 20,
  });
  assert.equal(matched.truncated, false);
  assert.equal(matched.indexCache.externalCandidateScan, true);
  assert.deepEqual(
    matched.matches.map((match) => match.path).sort(),
    ['source-007.md', 'source-053.md'],
  );

  const masked = await searchWorkspaceText(root, 'CANDIDATE_NEEDLE', {
    ...options,
    searchRevision: 2,
    fileMask: '*.ts',
  });
  assert.deepEqual(masked.matches, []);
  assert.equal(masked.indexCache.externalCandidateScan, true);

  const limited = await searchWorkspaceText(root, 'CANDIDATE_NEEDLE', {
    ...options,
    searchRevision: 3,
    maxMatches: 1,
  });
  assert.equal(limited.matches.length, 1);
  assert.equal(limited.truncated, true);
  assert.equal(limited.indexCache.externalCandidateScan, true);

  const missing = await searchWorkspaceText(root, 'CANDIDATE_NEEDLE_NOT_PRESENT', {
    ...options,
    searchRevision: 4,
  });
  assert.deepEqual(missing.matches, []);
  assert.equal(missing.truncated, false);
  assert.equal(missing.indexCache.externalCandidateScan, true);
});
