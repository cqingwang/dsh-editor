import assert from 'node:assert/strict';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

/**
 * Create one workspace holding a single file whose mtime is pinned.
 * @returns {Promise<{root: string, file: string, mtime: number, cleanup: () => Promise<void>}>} fixture.
 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-write-'));
  const file = join(root, 'note.txt');
  await writeFile(file, 'original\n');
  const stamp = new Date('2024-01-01T00:00:00Z');
  await utimes(file, stamp, stamp);
  return { root, file, mtime: stamp.getTime(), cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('write succeeds while the on-disk mtime matches the loaded one', async (t) => {
  const { root, mtime, cleanup } = await fixture();
  t.after(cleanup);
  const written = await workspaceFileOperations.write(root, 'note.txt', 'mine\n', mtime, false);
  assert.equal(written.path, 'note.txt');
  assert.ok(written.mtime >= mtime);
});

test('write refuses to clobber an external edit without force', async (t) => {
  const { root, mtime, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(
    () => workspaceFileOperations.write(root, 'note.txt', 'mine\n', mtime + 5000, false),
    (error) => error.code === 'dsh-editor/conflict' && typeof error.currentMtime === 'number',
  );
});

test('force overwrites despite a changed mtime', async (t) => {
  const { root, mtime, cleanup } = await fixture();
  t.after(cleanup);
  const written = await workspaceFileOperations.write(root, 'note.txt', 'forced\n', mtime + 5000, true);
  assert.equal(written.path, 'note.txt');
});

test('write reports a vanished file instead of recreating it', async (t) => {
  const { root, file, cleanup } = await fixture();
  t.after(cleanup);
  await rm(file);
  await assert.rejects(() => workspaceFileOperations.write(root, 'note.txt', 'x\n', undefined, false), /no longer exists/);
});
