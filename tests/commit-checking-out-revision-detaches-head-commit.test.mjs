import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitCheckoutRevision } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r124-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'a.txt'), 'one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'first');
  const first = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'a.txt'), 'two\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'second');
  return { dir, first, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('checking out a revision detaches HEAD at that commit', async (t) => {
  /* IDEA's "Checkout Revision" walks the log and lands on that commit, detached. */
  const { dir, first, cleanup } = await fixture();
  t.after(cleanup);
  const status = await gitCheckoutRevision(dir, first);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
  /* Detached: `symbolic-ref` has nothing to report. */
  assert.throws(() => git(dir, 'symbolic-ref', '-q', 'HEAD'));
  assert.equal(status.detached, true);
});

test('a duplicate checkout of the same revision leaves no local branch behind', async (t) => {
  const { dir, first, cleanup } = await fixture();
  t.after(cleanup);
  await gitCheckoutRevision(dir, first);
  await gitCheckoutRevision(dir, first);
  /* `git branch` prints "(HEAD detached at …)" while detached; only real refs count. */
  const branches = git(dir, 'branch', '--format=%(refname:short)')
    .split('\n')
    .filter((name) => name !== '' && !name.startsWith('('));
  assert.deepEqual(branches, ['main']);
});

test('an unknown revision is refused with context', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitCheckoutRevision(dir, 'deadbeefdeadbeef'), /no such commit/i);
  await assert.rejects(() => gitCheckoutRevision(dir, ''), /a commit hash is required/i);
  /* A value that looks like an option must not reach git's argv. */
  await assert.rejects(() => gitCheckoutRevision(dir, '--orphan'), /a commit hash is required|no such commit/i);
});
