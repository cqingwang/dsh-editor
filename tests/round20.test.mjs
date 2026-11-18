import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

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

test('the branch popup reads the list on open and confirms before a dirty checkout', () => {
  const client = read('lib/client.js');
  assert.match(client, /const openBranchMenu = React.useCallback\(async \(position\) => \{/);
  assert.match(client, /op: 'branches'/);
  /* A checkout under unsaved edits must ask first, like IDEA. */
  assert.match(client, /if \(dirty && !window\.confirm\(t\('editor\.checkoutDirty'\)\)\) return;/);
  assert.match(client, /op: 'checkout', branch: name/);
  assert.match(client, /setCommitNotice\(t\('editor\.checkoutDone', \{ name \}\)\)/);
  /* Handlers are declared after the callbacks they depend on (see static-order test). */
  assert.ok(client.indexOf('const openBranchMenu = React.useCallback(') > client.indexOf('const refreshTree = React.useCallback('));
  assert.ok(client.indexOf('const checkoutBranch = React.useCallback(') < client.indexOf('const openBranchMenu = React.useCallback('));
});

test('the commit toolbar shows the branch and uses it as the popup trigger', () => {
  const client = `${read('tests/fixtures/commit-panel.legacy.js')}\n${read('lib/client.js')}`;
  /* Round 125 routed the text through `branchLabel`, which also names detached HEAD. */
  assert.match(client, /const branchText = branchLabel\(git\);/);
  assert.match(client, /badge: branchText\.length === 0/);
  assert.match(client, /onBadge: onBranchMenu,/);
  assert.match(panelToolbarSource, /function PanelToolbar\(\{\s+icon,\s+title,\s+titleAction = null,[\s\S]*?badgeExpanded = undefined,\s+ariaLabel = null,/);
  /* The chip stays a plain label when no handler is supplied (Project panel). */
  assert.match(panelToolbarSource, /onBadge === undefined/);
});
