import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitRollback } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r81-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'tracked.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'root');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a staged-only change is discarded from the index, not from the file', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'staged edit\n');
  git(dir, 'add', 'tracked.txt');
  /* The working tree still holds the edit, so "discard staged" must leave it. */
  const after = await gitRollback(dir, { paths: ['tracked.txt'], staged: true });
  assert.equal(await readFile(join(dir, 'tracked.txt'), 'utf8'), 'staged edit\n');
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '');
  assert.equal(after.changes.some((change) => change.path === 'tracked.txt' && change.staged), false);
});

test('discarding the staged copy restores the committed content in the index', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'only staged\n');
  git(dir, 'add', 'tracked.txt');
  await gitRollback(dir, { paths: ['tracked.txt'], staged: true });
  /* Index matches HEAD again; the working file keeps the user's text. */
  assert.equal(git(dir, 'diff', '--cached', '--numstat'), '');
  assert.equal(await readFile(join(dir, 'tracked.txt'), 'utf8'), 'only staged\n');
});

test('discarding the working copy restores the file from the index', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'worktree edit\n');
  await gitRollback(dir, { paths: ['tracked.txt'] });
  assert.equal(await readFile(join(dir, 'tracked.txt'), 'utf8'), 'base\n');
});

test('the change menu offers both discards, worded apart', () => {
  const client = read('lib/client.js');
  const start = client.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = client.slice(start, client.indexOf('Context menu for one directory node', start));
  assert.match(block, /t\('editor\.rollbackStaged'\)/);
  assert.match(block, /batchLabel\('editor\.rollbackWorking', 'editor\.rollbackWorkingCount'\)/);
  assert.match(block, /staged: true/);
});
