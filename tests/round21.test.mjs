import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCherryPick, gitRestoreFile, gitRevert } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** A repository with two commits, the second adding a line. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r21-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'first']);
  const first = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'second']);
  return { dir, first, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('revert creates the inverse commit and leaves the tree clean', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const status = await gitRevert(dir, 'HEAD');
  assert.equal(status.branch, 'main');
  assert.deepEqual(status.changes, []);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'one\n');
});

test('restore brings one file back without touching the rest', async (t) => {
  const { dir, first, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'other.txt'), 'keep me\n');
  const status = await gitRestoreFile(dir, { hash: first, path: 'a.txt' });
  assert.equal(status.path, 'a.txt');
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'one\n');
  /* Only the requested path changes; anything else in the tree survives. */
  assert.equal(await readFile(join(dir, 'other.txt'), 'utf8'), 'keep me\n');
});

test('an empty file is restorable and is not mistaken for a missing one', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'empty.txt'), '');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'add empty']);
  const withEmpty = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  /* A revision that DOES contain an empty file must write '' instead of failing. */
  const status = await gitRestoreFile(dir, { hash: withEmpty, path: 'empty.txt' });
  assert.equal(status.path, 'empty.txt');
  assert.equal(await readFile(join(dir, 'empty.txt'), 'utf8'), '');
});

test('a revision without the file refuses instead of emptying it', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'later.txt'), 'later\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'add later']);
  const second = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim();

  await assert.rejects(() => gitRestoreFile(dir, { hash: second, path: 'later.txt' }), /does not contain this file/);
  /* The file must still hold its committed content, not be blanked. */
  assert.equal(await readFile(join(dir, 'later.txt'), 'utf8'), 'later\n');
});

test('history actions refuse option-shaped revisions and escaping paths', async (t) => {
  const { dir, first, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitRevert(dir, '--hard'), /invalid commit id/);
  await assert.rejects(() => gitCherryPick(dir, '--abort'), /invalid commit id/);
  await assert.rejects(() => gitRestoreFile(dir, { hash: first, path: '../etc/passwd' }), /escapes the workspace/);
  await assert.rejects(() => gitRestoreFile(dir, { hash: first, path: '' }), /a path is required/);
});

test('cherry-pick applies one commit onto the current branch', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  execFileSync('git', ['-C', dir, 'checkout', '-q', '-b', 'side', 'HEAD~1']);
  await writeFile(join(dir, 'side.txt'), 'side\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'side work']);
  const picked = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', dir, 'checkout', '-q', 'main']);

  const status = await gitCherryPick(dir, picked);
  assert.equal(status.branch, 'main');
  assert.deepEqual(status.changes, []);
  assert.equal(await readFile(join(dir, 'side.txt'), 'utf8'), 'side\n');
});

test('the log row menu offers cherry-pick, revert and restore', () => {
  const client = read('lib/client.js');
  assert.match(client, /const buildLogMenu = React\.useCallback\(/);
  assert.match(client, /run: \(\) => void runHistoryAction\('cherryPick', commit\.hash\)/);
  assert.match(client, /run: \(\) => void runHistoryAction\('revert', commit\.hash\)/);
  assert.match(client, /onContextMenu\?\.\(\{ commit, selectionHashes, x: event\.clientX, y: event\.clientY \}\)/);
  /* Two destructive git actions must confirm before running. */
  assert.match(client, /window\.confirm\(t\('editor\.historyActionConfirm'/);
  assert.match(client, /window\.confirm\(t\('editor\.restoreFileConfirm'/);
});

test('rewrites re-read the open tab instead of leaving stale bytes', () => {
  const client = read('lib/client.js');
  /* openFile short-circuits for an already open path, so it cannot refresh a tab. */
  assert.match(client, /const reloadFile = React\.useCallback\(async \(path\) => \{/);
  assert.match(client, /if \(openFilesRef\.current\.some\(\(file\) => file\.path === path\)\) await reloadFile\(path\);/);
  assert.match(client, /for \(const file of openFilesRef\.current\) await reloadFile\(file\.path\);/);
  assert.doesNotMatch(client, /openFile\(path, \{ force: true \}\)/);
});
