import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitCommitPatch } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function patchFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-commit-patch-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'a.txt'), 'one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'first subject');
  const first = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'a.txt'), 'two\n');
  git(dir, 'commit', '-qam', 'second: subject/with * unsafe? chars');
  const second = git(dir, 'rev-parse', 'HEAD');
  return {
    dir,
    first,
    second,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

test('a commit patch contains Git mail metadata and the commit diff', async (t) => {
  const { dir, first, second, cleanup } = await patchFixture();
  t.after(cleanup);
  const value = await gitCommitPatch(dir, second);

  assert.equal(value.hash, second);
  assert.equal(value.subject, 'second: subject/with * unsafe? chars');
  assert.match(value.patch, new RegExp(`^From ${second} `, 'mu'));
  assert.match(value.patch, /^Subject: \[PATCH\] second: subject\/with \* unsafe\? chars$/mu);
  assert.match(value.patch, /^diff --git a\/a\.txt b\/a\.txt$/mu);
  assert.match(value.patch, /^-one$/mu);
  assert.match(value.patch, /^\+two$/mu);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), second);
  assert.equal(git(dir, 'rev-parse', first), first);
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('creating a commit patch does not modify a dirty working tree or index', async (t) => {
  const { dir, second, cleanup } = await patchFixture();
  t.after(cleanup);
  await writeFile(join(dir, 'a.txt'), 'working tree\n');
  await writeFile(join(dir, 'staged.txt'), 'staged\n');
  git(dir, 'add', 'staged.txt');
  const before = git(dir, 'status', '--porcelain=v1');

  await gitCommitPatch(dir, second);

  assert.equal(git(dir, 'rev-parse', 'HEAD'), second);
  assert.equal(git(dir, 'status', '--porcelain=v1'), before);
});

test('an invalid commit is refused before Git writes anything', async (t) => {
  const { dir, second, cleanup } = await patchFixture();
  t.after(cleanup);
  await assert.rejects(() => gitCommitPatch(dir, '--hard'), /invalid commit id/);
  await assert.rejects(() => gitCommitPatch(dir, 'deadbeef'), /no such commit/);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), second);
});

test('commit patch download names keep the hash and sanitize the subject', async () => {
  const client = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
  const start = client.indexOf('function commitPatchDownloadName(');
  assert.notEqual(start, -1, 'commitPatchDownloadName is missing');
  const bodyStart = client.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
  assert.notEqual(end, -1, 'commitPatchDownloadName has no closing brace');
  const fn = new Function(`${client.slice(start, end)}; return commitPatchDownloadName;`)();
  const first = fn('abcdef123456', 'fix: path/with * unsafe? chars');
  const second = fn('1234567890ab', 'another subject');

  assert.equal(first, 'dsh-editor-abcdef1-fix-path-with-unsafe-chars.patch');
  assert.match(second, /^dsh-editor-1234567-another-subject\.patch$/u);
  assert.notEqual(first, second);
  assert.doesNotMatch(fn('abcdef1', 'x'.repeat(200)), /-x{60}/u);
});

test('Commit Log exposes Create Patch from Commit through the host route', async () => {
  const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/client/components/commit/log-menu.ts', import.meta.url), 'utf8');
  const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

  assert.match(menu, /id: 'createCommitPatch'/);
  assert.match(menu, /label: t\('editor\.createPatchFromCommitAction'\)/);
  assert.match(menu, /void createCommitPatch\(commit\.hash\)/);
  assert.match(locales, /createPatchFromCommitAction: '从提交创建补丁…'/);
  assert.match(locales, /createPatchFromCommitAction: 'Create Patch from Commit…'/);
  assert.match(client, /callGit\(\{ op: 'commitPatch', hash \}\)/);
  assert.match(client, /anchor\.download = downloadName/);
  assert.match(host, /async function gitCommitPatch\(/);
  assert.match(host, /'format-patch',\s*'-1',\s*'--stdout',\s*'--binary',\s*'--no-signature',\s*'--no-color'/);
  assert.match(host, /case 'commitPatch':[\s\S]*?gitCommitPatch\(root, String\(body\?\.hash \?\? ''\)\)/);
  assert.match(host, /export \{[^}]*gitCommitPatch[^}]*\};/);
});
