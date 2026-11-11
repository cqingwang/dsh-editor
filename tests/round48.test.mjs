import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitFetch, gitPull } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Run git and return trimmed stdout. */
function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

/**
 * A bare "origin" plus two clones, so one clone can push a commit the other
 * has not seen yet — the shape Fetch and Update Project exist for.
 */
async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'dsh-editor-r48-'));
  const remote = join(base, 'origin.git');
  const alice = join(base, 'alice');
  const bob = join(base, 'bob');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  execFileSync('git', ['clone', '-q', remote, alice]);
  for (const clone of [alice]) {
    git(clone, 'config', 'user.email', 'alice@example.com');
    git(clone, 'config', 'user.name', 'Alice');
  }
  await writeFile(join(alice, 'shared.txt'), 'first\n');
  git(alice, 'add', '.');
  git(alice, 'commit', '-qm', 'first commit');
  git(alice, 'push', '-q', '-u', 'origin', 'main');
  execFileSync('git', ['clone', '-q', remote, bob]);
  git(bob, 'config', 'user.email', 'bob@example.com');
  git(bob, 'config', 'user.name', 'Bob');
  return { base, remote, alice, bob, cleanup: () => rm(base, { recursive: true, force: true }) };
}

test('fetch moves the behind count without touching the working tree', async (t) => {
  const { alice, bob, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(alice, 'shared.txt'), 'second\n');
  git(alice, 'commit', '-qam', 'second commit');
  git(alice, 'push', '-q');

  /* Before fetching, bob's clone has no idea the upstream moved. */
  const stale = await gitFetch(bob);
  assert.equal(stale.behind, 1);
  assert.equal(stale.ahead, 0);
  /* Fetch must not change the checked-out content. */
  assert.equal(await readFile(join(bob, 'shared.txt'), 'utf8'), 'first\n');
  assert.deepEqual(stale.remotes, ['origin']);
});

test('update project fast-forwards the checked-out branch', async (t) => {
  const { alice, bob, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(alice, 'shared.txt'), 'second\n');
  git(alice, 'commit', '-qam', 'second commit');
  git(alice, 'push', '-q');

  const updated = await gitPull(bob);
  assert.equal(updated.behind, 0);
  assert.equal(updated.branch, 'main');
  assert.equal(await readFile(join(bob, 'shared.txt'), 'utf8'), 'second\n');
  assert.equal(git(bob, 'log', '-1', '--pretty=%s'), 'second commit');
});

test('a diverged branch fails with git\'s own sentence instead of opening a merge', async (t) => {
  const { alice, bob, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(alice, 'shared.txt'), 'from alice\n');
  git(alice, 'commit', '-qam', 'alice work');
  git(alice, 'push', '-q');
  await writeFile(join(bob, 'local.txt'), 'bob\n');
  git(bob, 'add', '.');
  git(bob, 'commit', '-qm', 'bob work');

  await assert.rejects(() => gitPull(bob), /update failed: .*(diverg|fast-forward|merge)/iu);
  /* The failed update must leave bob's HEAD alone. */
  assert.equal(git(bob, 'log', '-1', '--pretty=%s'), 'bob work');
});

test('a branch without an upstream and a repo without a remote say so', async (t) => {
  const { alice, bob, cleanup } = await fixture();
  t.after(cleanup);
  git(bob, 'checkout', '-q', '-b', 'local-only');
  await assert.rejects(() => gitPull(bob), /no upstream/u);

  const lonely = await mkdtemp(join(tmpdir(), 'dsh-editor-r48-solo-'));
  t.after(() => rm(lonely, { recursive: true, force: true }));
  execFileSync('git', ['-C', lonely, 'init', '-q', '-b', 'main']);
  git(lonely, 'config', 'user.email', 'solo@example.com');
  git(lonely, 'config', 'user.name', 'Solo');
  await writeFile(join(lonely, 'a.txt'), '1\n');
  git(lonely, 'add', '.');
  git(lonely, 'commit', '-qm', 'only');
  await assert.rejects(() => gitFetch(lonely), /no remote/u);
  await assert.rejects(() => gitPull(lonely), /no upstream/u);
  assert.equal(alice.length > 0, true);
});

test('the commit toolbar offers Fetch and Update Project, and reloads open files', () => {
  const client = read('lib/client.js');
  /* Both actions live in the Commit toolbar, between the branch chip and Stash. */
  for (const [id, key] of [['fetch', 'editor.fetchRemote'], ['update', 'editor.updateProject']]) {
    const at = client.indexOf(`id: '${id}',`);
    assert.notEqual(at, -1, `${id} button is missing`);
    const block = client.slice(at, at + 400);
    assert.match(block, new RegExp(`icon: '${id}'`), `${id} needs its own icon`);
    assert.ok(block.includes(`t('${key}')`), `${id} needs the ${key} label`);
  }
  /* Update rewrites working files, so an unsaved buffer has to be confirmed first. */
  assert.match(client, /t\('editor\.updateDirty'\)/);
  assert.match(client, /for \(const file of openFilesRef\.current\) await reloadFile\(file\.path\)/);
  /* Keep the two dictionaries in step: a missing key renders as the raw key. */
  for (const key of ['updateProject', 'fetchRemote', 'updateDirty', 'updateDone', 'fetchDone']) {
    const hits = client.split(`${key}:`).length - 1;
    assert.ok(hits >= 2, `${key} must exist in both dictionaries, found ${hits}`);
  }
});

test('the host routes fetch and update through the git API', () => {
  const host = read('lib/index.js');
  assert.match(host, /case 'fetch':\s+return ok\(await gitFetch\(root\)\);/);
  assert.match(host, /case 'pull':\s+return ok\(await gitPull\(root\)\);/);
  assert.match(host, /export \{[\s\S]*gitFetch[\s\S]*gitPull[\s\S]*\};/);
});
