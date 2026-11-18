import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitCreateBranch } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function historyFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-branch-from-commit-'));
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

test('a branch can be created at an arbitrary historical commit', async (t) => {
  const { dir, first, second, cleanup } = await historyFixture();
  t.after(cleanup);
  const value = await gitCreateBranch(dir, { name: 'from-first', checkout: false, startPoint: first });
  assert.equal(git(dir, 'rev-parse', 'from-first'), first);
  assert.equal(git(dir, 'rev-parse', 'main'), second);
  assert.equal(value.startPoint, first);
});

test('creating from history can check out the new branch', async (t) => {
  const { dir, first, cleanup } = await historyFixture();
  t.after(cleanup);
  await gitCreateBranch(dir, { name: 'from-first', checkout: true, startPoint: first });
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'from-first');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
});

test('an unknown branch start point is refused before creation', async (t) => {
  const { dir, cleanup } = await historyFixture();
  t.after(cleanup);
  await assert.rejects(
    () => gitCreateBranch(dir, { name: 'nope', checkout: false, startPoint: 'deadbeef' }),
    /no such commit/,
  );
  assert.equal(git(dir, 'branch', '--list', 'nope'), '');
});

test('Commit Log exposes New Branch from the selected commit', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const menuStart = client.indexOf('const buildLogMenu = React.useCallback');
  const menuEnd = client.indexOf('/* Rollback discards edits', menuStart);
  const menu = client.slice(menuStart, menuEnd);
  assert.match(menu, /id: 'newBranchFromCommit'/);
  assert.match(menu, /label: t\('editor\.newBranchFromCommitAction', \{ hash: commit\.hash\.slice\(0, 7\) \}\)/);
  assert.match(menu, /kind: 'branch',[\s\S]*?hash: commit\.hash/);
  assert.match(client, /namePrompt\.hash !== '' \? \{ startPoint: namePrompt\.hash \} : \{\}/);
  assert.match(client, /newBranchFromCommitAction: '从提交 \{hash\} 新建分支…'/);
  assert.match(client, /newBranchFromCommitAction: 'New Branch from \{hash\}…'/);
});
