import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-atomic-write-'));
  const file = join(root, 'note.txt');
  await writeFile(file, 'original\n');
  const stamp = new Date('2024-01-01T00:00:00Z');
  await utimes(file, stamp, stamp);
  return { root, file, mtime: stamp.getTime(), cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('atomic write replaces the inode and preserves permission bits', async (t) => {
  const { root, file, mtime, cleanup } = await fixture();
  t.after(cleanup);
  await chmod(file, 0o640);
  const before = await stat(file);
  const written = await workspaceFileOperations.write(root, 'note.txt', 'atomic\n', mtime, false);
  const after = await stat(file);
  assert.equal(await readFile(file, 'utf8'), 'atomic\n');
  assert.notEqual(after.ino, before.ino);
  assert.equal(after.mode & 0o777, 0o640);
  assert.equal(written.path, 'note.txt');
  assert.deepEqual((await readdir(root)).filter((name) => name.includes('.dsh-editor-')), []);
});

test('atomic create writes a new file without leaving a temporary sibling', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  const written = await workspaceFileOperations.write(root, 'created.txt', 'new\n', undefined, true, true);
  assert.equal(await readFile(join(root, 'created.txt'), 'utf8'), 'new\n');
  assert.equal(written.created, true);
  assert.deepEqual((await readdir(root)).filter((name) => name.includes('.dsh-editor-')), []);
});

test('atomic write through a symlink updates its target and preserves the link', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  const target = join(root, 'target.txt');
  const link = join(root, 'link.txt');
  await writeFile(target, 'target\n');
  const stamp = new Date('2024-02-01T00:00:00Z');
  await utimes(target, stamp, stamp);
  await symlink(target, link);
  await workspaceFileOperations.write(root, 'link.txt', 'through-link\n', stamp.getTime(), false);
  assert.equal((await lstat(link)).isSymbolicLink(), true);
  assert.equal(await readFile(target, 'utf8'), 'through-link\n');
  assert.equal(await readFile(link, 'utf8'), 'through-link\n');
  assert.deepEqual((await readdir(root)).filter((name) => name.includes('.dsh-editor-')), []);
});
