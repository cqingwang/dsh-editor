import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** One workspace file that can be deleted under the editor. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r37-'));
  await writeFile(join(dir, 'a.txt'), 'original\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a normal save refuses to resurrect a deleted file', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await unlink(join(dir, 'a.txt'));
  /* Saving must not silently recreate: that would mask a deletion the user did not make. */
  await assert.rejects(() => workspaceFileOperations.write(dir, 'a.txt', 'x\n', undefined, true), /no longer exists/);
});

test('an explicit create write brings the file back', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await unlink(join(dir, 'a.txt'));
  const result = await workspaceFileOperations.write(dir, 'a.txt', 'restored\n', undefined, true, true);
  assert.equal(result.created, true);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'restored\n');
});

test('recreating a nested path makes the parent directories', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const result = await workspaceFileOperations.write(dir, 'deep/nested/file.txt', 'deep\n', undefined, true, true);
  assert.equal(result.path, 'deep/nested/file.txt');
  assert.equal(await readFile(join(dir, 'deep', 'nested', 'file.txt'), 'utf8'), 'deep\n');
});

test('creating still refuses a path outside the workspace', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => workspaceFileOperations.write(dir, '../escape.txt', 'x', undefined, true, true), /escapes the workspace/);
});

test('the recreate button asks the host to create, not to overwrite', () => {
  const client = read('lib/client.js');
  assert.match(client, /t\('editor\.recreateFile'\)/);
  assert.match(client, /op: 'write', path, content: model\.getValue\(\), force: true, create: true/);
  const host = read('lib/index.js');
  assert.match(host, /if \(create !== true\) throw new Error\('the file no longer exists on disk'\);/);
  assert.match(host, /await mkdir\(dirname\(file\), \{ recursive: true \}\);/);
});
