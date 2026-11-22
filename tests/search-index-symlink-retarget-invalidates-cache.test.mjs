import assert from 'node:assert/strict';
import { lstat, mkdtemp, rm, stat, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchWorkspaceText } from '../lib/index.js';

test('a retargeted symlink does not reuse cached content from the old target', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symlink creation requires elevated privileges on some Windows hosts');
    return;
  }
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-symlink-'));
  const targetDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-symlink-targets-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-symlink-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(targetDirectory, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));

  const firstTarget = join(targetDirectory, 'first.ts');
  const secondTarget = join(targetDirectory, 'second.ts');
  const link = join(root, 'linked.ts');
  await writeFile(firstTarget, 'SYMLINK_OLD_NEEDLE\n', 'utf8');
  await writeFile(secondTarget, 'SYMLINK_NEW_NEEDLE\n', 'utf8');
  await symlink(firstTarget, link);
  const originalTargetInfo = await stat(link);
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  await unlink(link);
  await symlink(secondTarget, link);
  await utimes(secondTarget, originalTargetInfo.atime, originalTargetInfo.mtime);
  const currentTargetInfo = await stat(link);
  assert.equal((await lstat(link)).isSymbolicLink(), true);
  assert.equal(currentTargetInfo.size, originalTargetInfo.size);
  assert.ok(Math.abs(currentTargetInfo.mtimeMs - originalTargetInfo.mtimeMs) <= 1);

  const result = await searchWorkspaceText(root, 'SYMLINK_NEW_NEEDLE', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['linked.ts'],
  );
  assert.equal(result.indexCache.hits, 0);
  assert.equal(result.indexCache.misses, 1);
});
