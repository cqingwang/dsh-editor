import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

import { gitCreateBranch } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

/** One repository with a single commit, on `main`. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r65-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'a.txt'), '1\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'root');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a new branch is created at HEAD and checked out', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitCreateBranch(dir, { name: 'feature/popup', checkout: true });
  assert.equal(value.branch, 'feature/popup');
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature/popup');
  /* Same commit as the branch it was forked from: IDEA forks at the current HEAD. */
  assert.equal(git(dir, 'rev-parse', 'HEAD'), git(dir, 'rev-parse', 'main'));
  assert.ok(value.branches.includes('feature/popup'));
});

test('a branch can be created without switching to it', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitCreateBranch(dir, { name: 'later', checkout: false });
  assert.equal(value.branch, 'main');
  assert.ok(value.branches.includes('later'));
});

test('bad names are refused before git runs, with the reason spelled out', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitCreateBranch(dir, { name: '' }), /a branch name is required/u);
  await assert.rejects(() => gitCreateBranch(dir, { name: '--orphan=x' }), /may not start with/u);
  await assert.rejects(() => gitCreateBranch(dir, { name: 'a b' }), /spaces/u);
  await assert.rejects(() => gitCreateBranch(dir, { name: 'main' }), /already exists/u);
  /* Nothing was created and HEAD never moved. */
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

test('the branch popup offers new-branch and prompts for a name', async () => {
  const client = read('src/client/editor-workspace.tsx');
  let menu = null;
  let prompt = null;
  const openBranchMenu = loadTypeScriptCallback(client, 'openBranchMenu', {
    t: (key) => key,
    callGit: async () => ({ branches: ['main'], branch: 'main' }),
    setCommitBusy: () => {},
    setCommitError: () => {},
    setMenu: (value) => {
      menu = value;
    },
    setNamePrompt: (value) => {
      prompt = value;
    },
    checkoutBranch: async () => {},
  });
  await openBranchMenu({ x: 10, y: 20 });
  const item = menu.items.find((entry) => entry?.id === 'newBranch');
  item.run();
  assert.equal(prompt.kind, 'branch');
  assert.equal(prompt.title, 'editor.newBranchAction');
});

test('the host routes the new operation and exports it', () => {
  const host = read('lib/index.js');
  assert.match(host, /case 'createBranch':\s+return ok\(await gitCreateBranch\(root, body\)\);/);
  assert.match(host, /export \{[\s\S]*gitCreateBranch[\s\S]*\};/);
});
