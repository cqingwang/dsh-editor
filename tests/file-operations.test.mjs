import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

/**
 * Create one throwaway workspace root.
 * @returns {Promise<{root: string, cleanup: () => Promise<void>}>} fixture handle.
 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-fs-'));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('rename moves a file and reports both identities', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(root, 'a.txt'), 'alpha\n');

  const moved = await workspaceFileOperations.rename(root, 'a.txt', 'nested/b.txt');
  assert.deepEqual(moved, { path: 'nested/b.txt', from: 'a.txt' });
  assert.equal(await readFile(join(root, 'nested/b.txt'), 'utf8'), 'alpha\n');
  await assert.rejects(() => stat(join(root, 'a.txt')));
});

test('rename refuses to overwrite an existing target', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(root, 'a.txt'), 'alpha\n');
  await writeFile(join(root, 'b.txt'), 'beta\n');

  /* The message names the conflicting entry; a bare "target exists" leaves the user guessing. */
  await assert.rejects(() => workspaceFileOperations.rename(root, 'a.txt', 'b.txt'), /b\.txt already exists/);
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'alpha\n');
});

test('rename refuses destinations outside the workspace', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(root, 'a.txt'), 'alpha\n');

  await assert.rejects(() => workspaceFileOperations.rename(root, 'a.txt', '../escaped.txt'), /path escapes the workspace/);
});

test('delete removes a directory and refuses the workspace root', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await mkdir(join(root, 'folder'));
  await writeFile(join(root, 'folder/inside.txt'), 'x\n');

  assert.deepEqual(await workspaceFileOperations.remove(root, 'folder'), { path: 'folder', deleted: true });
  await assert.rejects(() => stat(join(root, 'folder')));
  await assert.rejects(() => workspaceFileOperations.remove(root, ''), /refusing to delete the workspace root/);
});

test('delete reports a missing path instead of silently succeeding', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => workspaceFileOperations.remove(root, 'ghost.txt'), /path does not exist/);
});
