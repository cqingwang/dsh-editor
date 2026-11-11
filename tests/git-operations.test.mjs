import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { gitCommit, gitDiff, gitInspect, gitLastCommit, gitLog, gitResolveConflict, gitRollback, gitShowCommit, gitStage, gitStatus } from '../lib/index.js';

const run = promisify(execFile);

/**
 * Create a throwaway repository with one tracked file.
 * @returns {Promise<{dir: string, cleanup: () => Promise<void>}>} fixture handle.
 */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-git-'));
  await run('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  await run('git', ['-C', dir, 'config', 'user.email', 'editor@example.test']);
  await run('git', ['-C', dir, 'config', 'user.name', 'Editor Test']);
  await run('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  await run('git', ['-C', dir, 'add', '-A']);
  await run('git', ['-C', dir, 'commit', '-qm', 'initial commit']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('status reports branch identity, last commit and porcelain changes', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');
  await writeFile(join(dir, 'added.txt'), 'new\n');

  const status = await gitStatus(dir);
  assert.equal(status.branch, 'main');
  assert.equal(status.prefix, '');
  assert.equal(status.detached, false);
  assert.equal(status.lastCommit?.subject, 'initial commit');
  assert.deepEqual(
    status.changes.map((change) => [change.path, change.status]),
    [
      ['added.txt', '??'],
      ['tracked.txt', ' M'],
    ],
  );
});

test('stage moves one path into the index and reset moves it back', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');

  const staged = await gitStage(dir, { paths: ['tracked.txt'], staged: false });
  assert.equal(staged.changes[0].status, 'M ');
  assert.equal(staged.changes[0].staged, true);

  const unstaged = await gitStage(dir, { paths: ['tracked.txt'], staged: true });
  assert.equal(unstaged.changes[0].status, ' M');
  assert.equal(unstaged.changes[0].staged, false);
});

test('diff exposes the HEAD and working-tree sides for an unstaged change', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');

  const diff = await gitDiff(dir, '', { path: 'tracked.txt', staged: false });
  assert.equal(diff.original, 'one\n');
  assert.equal(diff.modified, 'one\ntwo\n');
  assert.equal(diff.staged, false);
  assert.equal(diff.missing, false);
  assert.equal(diff.binary, false);
});

test('diff of an untracked file starts from an empty left side', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'fresh.txt'), 'fresh\n');

  const diff = await gitDiff(dir, '', { path: 'fresh.txt', staged: false });
  assert.equal(diff.original, '');
  assert.equal(diff.modified, 'fresh\n');
  assert.equal(diff.headExists, false);
});

test('diff of a staged change compares HEAD against the index', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\nstaged\n');
  await gitStage(dir, { paths: ['tracked.txt'], staged: false });
  await writeFile(join(dir, 'tracked.txt'), 'one\nstaged\nlater\n');

  const diff = await gitDiff(dir, '', { path: 'tracked.txt', staged: true });
  assert.equal(diff.original, 'one\n');
  assert.equal(diff.modified, 'one\nstaged\nlater\n');
  assert.equal(diff.staged, true);
});

test('last commit survives an unborn HEAD', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-empty-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await run('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  assert.equal(await gitLastCommit(dir), null);
});

test('stage refuses a path that escapes the workspace', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitStage(dir, { paths: ['../outside.txt'], staged: false }), /path escapes the workspace/);
});

test('rollback restores a tracked file and deletes an untracked one', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\nedited\n');
  await writeFile(join(dir, 'fresh.txt'), 'fresh\n');

  const status = await gitRollback(dir, ['tracked.txt', 'fresh.txt']);
  assert.deepEqual(status.changes, []);
  assert.equal(await readFile(join(dir, 'tracked.txt'), 'utf8'), 'one\n');
  await assert.rejects(() => stat(join(dir, 'fresh.txt')));
});

test('rollback only touches the requested paths', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\na\n');
  await writeFile(join(dir, 'other.txt'), 'other\n');
  await run('git', ['-C', dir, 'add', 'other.txt']);
  await run('git', ['-C', dir, 'commit', '-qm', 'add other']);
  await writeFile(join(dir, 'other.txt'), 'other edited\n');

  const status = await gitRollback(dir, ['tracked.txt']);
  assert.deepEqual(status.changes.map((change) => change.path), ['other.txt']);
  assert.equal(await readFile(join(dir, 'other.txt'), 'utf8'), 'other edited\n');
});

test('show returns commit metadata and its changed files', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'second.txt'), 'two\n');
  await run('git', ['-C', dir, 'add', '-A']);
  await run('git', ['-C', dir, 'commit', '-qm', 'add second']);

  const detail = await gitShowCommit(dir, 'HEAD');
  assert.equal(detail.subject, 'add second');
  assert.equal(detail.author, 'Editor Test');
  assert.deepEqual(detail.files, [{ status: 'A', path: 'second.txt' }]);
});

test('show rejects a malformed commit id', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitShowCommit(dir, '--all'), /invalid commit id/);
});

test('log lists commits newest first with author and subject', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'b.txt'), 'b\n');
  await run('git', ['-C', dir, 'add', '-A']);
  await run('git', ['-C', dir, 'commit', '-qm', 'second commit']);

  const commits = await gitLog(dir, 10);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].subject, 'second commit');
  assert.equal(commits[1].subject, 'initial commit');
  assert.match(commits[0].hash, /^[0-9a-f]{40}$/);
  assert.equal(commits[0].author, 'Editor Test');
});

test('log clamps the requested limit', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const commits = await gitLog(dir, 10_000);
  assert.equal(commits.length, 1);
});

test('inspect reports whitespace problems in the selected files', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one   \ntrailing\n');
  const result = await gitInspect(dir, ['tracked.txt']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.whitespace, ['tracked.txt']);
  assert.deepEqual(result.conflicts, []);
});

test('inspect passes a clean change', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');
  const result = await gitInspect(dir, ['tracked.txt']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.whitespace, []);
});

test('commit surfaces a push failure without losing the commit', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ncommit me\n');
  const result = await gitCommit(dir, { message: 'work', paths: ['tracked.txt'], push: true });
  assert.match(result.pushError ?? '', /no configured push destination|does not appear to be a git repository|No configured push destination/i);
  assert.equal(result.changes.length, 0);
  assert.equal(result.lastCommit?.subject, 'work');
});

test('conflict resolution takes one side and stages the file', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await run('git', ['-C', dir, 'checkout', '-q', '-b', 'other']);
  await writeFile(join(dir, 'tracked.txt'), 'theirs\n');
  await run('git', ['-C', dir, 'commit', '-qam', 'theirs']);
  await run('git', ['-C', dir, 'checkout', '-q', 'main']);
  await writeFile(join(dir, 'tracked.txt'), 'ours\n');
  await run('git', ['-C', dir, 'commit', '-qam', 'ours']);
  await run('git', ['-C', dir, 'merge', 'other']).catch(() => {});

  const conflicted = await gitStatus(dir);
  assert.equal(conflicted.changes.find((change) => change.path === 'tracked.txt').status, 'UU');
  const inspection = await gitInspect(dir, ['tracked.txt']);
  assert.deepEqual(inspection.conflicts, ['tracked.txt']);

  const resolved = await gitResolveConflict(dir, { paths: ['tracked.txt'], side: 'theirs' });
  assert.equal(resolved.changes.find((change) => change.path === 'tracked.txt').status, 'M ');
  assert.equal((await readFile(join(dir, 'tracked.txt'), 'utf8')).trim(), 'theirs');
});
