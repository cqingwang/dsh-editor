import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitPush, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** A bare remote plus a working clone with one commit. */
async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'dsh-editor-r28-'));
  const remote = join(base, 'remote.git');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  const work = join(base, 'work');
  execFileSync('git', ['clone', '-q', remote, work], { stdio: 'pipe' });
  execFileSync('git', ['-C', work, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', work, 'config', 'user.name', 'Test']);
  await writeFile(join(work, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', work, 'add', '.']);
  execFileSync('git', ['-C', work, 'commit', '-qm', 'init']);
  return { base, remote, work, cleanup: () => rm(base, { recursive: true, force: true }) };
}

test('the first push publishes the branch and sets its upstream', async (t) => {
  const { work, remote, cleanup } = await fixture();
  t.after(cleanup);
  /* A fresh branch has no upstream: plain `git push` would fail with hints. */
  assert.equal((await gitStatus(work)).upstream, '');
  const pushed = await gitPush(work);
  assert.equal(pushed.published, true);
  assert.equal(pushed.branch, 'main');
  assert.equal((await gitStatus(work)).upstream, 'origin/main');
  /* The remote really received it. */
  const listed = execFileSync('git', ['-C', remote, 'rev-parse', '--verify', 'refs/heads/main'], { encoding: 'utf8' }).trim();
  assert.match(listed, /^[0-9a-f]{40}$/);
});

test('a branch that already tracks its upstream publishes only once', async (t) => {
  const { work, cleanup } = await fixture();
  t.after(cleanup);
  await gitPush(work);
  const second = await gitPush(work);
  assert.equal(second.published, false);
});

test('a rejected push reports the reason, not the whole stderr', async (t) => {
  const { base, remote, work, cleanup } = await fixture();
  t.after(cleanup);
  /* Publish first, then diverge the two clones so the second push is a real rejection. */
  await gitPush(work);
  const other = join(base, 'other');
  execFileSync('git', ['clone', '-q', remote, other], { stdio: 'pipe' });
  execFileSync('git', ['-C', other, 'config', 'user.email', 'o@b.c']);
  execFileSync('git', ['-C', other, 'config', 'user.name', 'O']);
  await writeFile(join(other, 'b.txt'), 'remote\n');
  execFileSync('git', ['-C', other, 'add', '.']);
  execFileSync('git', ['-C', other, 'commit', '-qm', 'remote work']);
  execFileSync('git', ['-C', other, 'push', '-q', 'origin', 'main']);

  await writeFile(join(work, 'a.txt'), 'local\n');
  execFileSync('git', ['-C', work, 'commit', '-qam', 'local work']);
  await assert.rejects(
    () => gitPush(work),
    (error) => {
      /* One sentence with git's own reason, never a multi-line dump. */
      assert.match(error.message, /^push failed: /);
      /* The reason comes first; git may append its multi-line explanation after it. */
      assert.match(error.message, /rejected/);
      assert.doesNotMatch(error.message, /^push failed: To /);
      return true;
    },
  );
});

test('a detached HEAD refuses to push', async (t) => {
  const { work, cleanup } = await fixture();
  t.after(cleanup);
  execFileSync('git', ['-C', work, 'checkout', '-q', '--detach']);
  await assert.rejects(() => gitPush(work), /detached/);
});

test('a failed push keeps its own state so a retry button can appear', () => {
  const client = read('lib/client.js');
  assert.match(client, /const \[pushError, setPushError\] = React\.useState\(null\);/);
  assert.match(client, /const pushNow = React\.useCallback\(async \(\) => \{/);
  assert.match(client, /op: 'push' \}/);
  /* The commit no longer hides the failure inside the generic error slot. */
  assert.match(client, /setPushError\(value\.pushError \?\? null\);/);
  assert.match(client, /t\('editor\.retryPush'\)/);
  assert.match(client, /onPush: \(\) => void pushNow\(\)/);
});
