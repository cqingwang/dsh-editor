import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitResetToRevision } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function historyFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-reset-branch-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'a.txt'), 'one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'one');
  const first = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'a.txt'), 'two\n');
  git(dir, 'commit', '-qam', 'two');
  return { dir, first, second: git(dir, 'rev-parse', 'HEAD'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('soft reset moves the branch but keeps index and working tree', async (t) => {
  const { dir, first, cleanup } = await historyFixture();
  t.after(cleanup);
  const value = await gitResetToRevision(dir, { hash: first, mode: 'soft' });
  assert.equal(value.resetMode, 'soft');
  assert.equal(value.resetTo, first);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'two\n');
  assert.match(git(dir, 'diff', '--cached', '--name-only'), /a\.txt/);
});

test('mixed reset moves branch and index but keeps the working tree', async (t) => {
  const { dir, first, cleanup } = await historyFixture();
  t.after(cleanup);
  await gitResetToRevision(dir, { hash: first, mode: 'mixed' });
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'two\n');
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '');
  assert.match(git(dir, 'diff', '--name-only'), /a\.txt/);
});

test('hard reset moves branch, index and working tree', async (t) => {
  const { dir, first, cleanup } = await historyFixture();
  t.after(cleanup);
  await gitResetToRevision(dir, { hash: first, mode: 'hard' });
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'one\n');
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('invalid reset mode or commit is rejected without moving HEAD', async (t) => {
  const { dir, second, cleanup } = await historyFixture();
  t.after(cleanup);
  await assert.rejects(() => gitResetToRevision(dir, { hash: second, mode: 'merge' }), /soft, mixed or hard/);
  await assert.rejects(() => gitResetToRevision(dir, { hash: 'deadbeef', mode: 'soft' }), /no such commit/);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), second);
});

test('Commit Log exposes reset modes with Hard protected by dirty-tab confirmation', async () => {
  const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/client/components/commit/log-menu.ts', import.meta.url), 'utf8');
  assert.match(menu, /id: 'resetBranchHere'/);
  assert.match(menu, /disabled: detached/);
  assert.match(menu, /id: 'resetSoft'/);
  assert.match(menu, /id: 'resetMixed'/);
  assert.match(menu, /id: 'resetHard'[\s\S]*?danger: true/);

  const resetStart = client.indexOf('const resetBranchHere = React.useCallback');
  const resetEnd = client.indexOf('const runHistoryAction', resetStart);
  const reset = client.slice(resetStart, resetEnd);
  assert.match(reset, /openFilesRef\.current\.filter\(\(file\) => file\.dirty === true\)\.length/);
  assert.match(reset, /editor\.resetHardConfirm/);
  assert.match(reset, /editor\.resetConfirm/);
  assert.match(reset, /callGit(?:<[^()]*>)?\(\s*\{\s*op: 'resetBranch',\s*hash,\s*mode,?\s*\}\s*\)/);
  assert.match(reset, /if \(mode === 'hard'\) \{[\s\S]*?reloadFile\(file\.path\)/);
});

test('reset actions are localized and routed by the host', async () => {
  const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  assert.match(locales, /resetBranchHereAction: '将当前分支重置到此处…'/);
  assert.match(locales, /resetHard: 'Hard（丢弃已跟踪修改）'/);
  assert.match(locales, /resetBranchHereAction: 'Reset Current Branch to Here…'/);
  assert.match(locales, /resetHard: 'Hard \(discard tracked changes\)'/);
  assert.match(host, /case 'resetBranch':\s+return ok\(await gitResetToRevision\(root, body\)\);/);
  assert.match(host, /export \{[\s\S]*gitResetToRevision[\s\S]*\};/);
});
