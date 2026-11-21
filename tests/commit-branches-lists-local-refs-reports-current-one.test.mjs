import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';
import { loadTypeScriptCallback } from './ts-source.mjs';

import { gitBranches, gitCheckout } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** A repository with `main` plus one extra branch. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r20-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  execFileSync('git', ['-C', dir, 'branch', 'feature']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('branches lists local refs and reports the current one', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitBranches(dir);
  assert.equal(value.branch, 'main');
  assert.deepEqual([...value.branches].sort(), ['feature', 'main']);
});

test('checkout switches branches and returns the refreshed status', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const status = await gitCheckout(dir, 'feature');
  assert.equal(status.branch, 'feature');
  assert.deepEqual(status.changes, []);
});

test('checkout only accepts a name the repository actually has', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  /* An unverified value would reach the git argv and could be read as an option. */
  await assert.rejects(() => gitCheckout(dir, '--orphan=evil'), /unknown branch/);
  await assert.rejects(() => gitCheckout(dir, 'nope'), /unknown branch/);
  await assert.rejects(() => gitCheckout(dir, '   '), /a branch name is required/);
});

test('the branch popup reads the list on open and confirms before a dirty checkout', async () => {
  const client = read('src/client/editor-workspace.tsx');
  const calls = [];
  const menus = [];
  let prompt = null;
  let confirmResult = false;
  let gitCalls = 0;
  const t = (key) => key;
  const checkoutBranch = loadTypeScriptCallback(client, 'checkoutBranch', {
    t,
    openFilesRef: { current: [{ path: 'a.txt', dirty: true }] },
    window: {
      confirm: () => confirmResult,
      setTimeout: (callback) => callback(),
    },
    callGit: async (request) => {
      gitCalls += 1;
      calls.push(request);
      return { root: '/repo', branch: request.branch, prefix: '', changes: [] };
    },
    beginCommitOperation: () => true,
    endCommitOperation: () => {},
    setCommitError: () => {},
    setGit: () => {},
    setCommitSelection: () => {},
    setDiffTarget: () => {},
    setExternalChanges: () => {},
    refreshTree: async () => {},
    setHistoryPath: () => {},
    loadLog: async () => {},
    setCommitNotice: (message) => calls.push(message),
    reloadFile: async () => {},
  });
  await checkoutBranch('feature');
  assert.equal(gitCalls, 0);
  confirmResult = true;
  await checkoutBranch('feature');
  assert.deepEqual(calls.at(-2), { op: 'checkout', branch: 'feature' });
  assert.equal(calls.at(-1), 'editor.checkoutDone');

  const openBranchMenu = loadTypeScriptCallback(client, 'openBranchMenu', {
    branchMenuRequestRef: { current: 0 },
    t,
    callGit: async () => ({ branches: ['main', 'feature'], branch: 'main' }),
    beginCommitOperation: () => true,
    endCommitOperation: () => {},
    setCommitError: () => {},
    setMenu: (menu) => menus.push(menu),
    branchPromptOriginRef: { current: null },
    openNamePrompt: (value) => {
      prompt = value;
    },
    checkoutBranch,
  });
  await openBranchMenu({ x: 12, y: 24 });
  assert.equal(menus.length, 1);
  assert.equal(menus[0].x, 12);
  assert.equal(menus[0].y, 24);
  const newBranch = menus[0].items.find((item) => item?.id === 'newBranch');
  newBranch.run();
  assert.equal(prompt.kind, 'branch');
  assert.equal(prompt.title, 'editor.newBranchAction');
});

test('the commit toolbar shows the branch and uses it as the popup trigger', () => {
  const client = `${read('src/client/components/commit/CommitPanel.tsx')}\n${read('lib/client.js')}`;
  /* Round 125 routed the text through `branchLabel`, which also names detached HEAD. */
  assert.match(client, /const branchText = branchLabel\(git\);/);
  assert.match(client, /badge=\{\s+branchText\.length === 0/u);
  assert.match(client, /onBadge=\{onBranchMenu\}/u);
  assert.match(panelToolbarSource, /function PanelToolbar\(\{\s+icon,\s+title,\s+titleAction = null,[\s\S]*?badgeExpanded = undefined,\s+ariaLabel = null,/);
  /* The chip stays a plain label when no handler is supplied (Project panel). */
  assert.match(panelToolbarSource, /onBadge === undefined/);
});
