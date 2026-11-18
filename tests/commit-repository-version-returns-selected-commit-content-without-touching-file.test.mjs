import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitRepositoryVersion } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function revisionFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-repository-version-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'kept.txt'), 'older content\n');
  await writeFile(join(dir, 'deleted.txt'), 'will disappear\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'older');
  const older = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'kept.txt'), 'newer content\n');
  execFileSync('git', ['-C', dir, 'rm', '-q', 'deleted.txt']);
  git(dir, 'commit', '-qam', 'newer');
  return { dir, older, newer: git(dir, 'rev-parse', 'HEAD'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('repository version returns the selected commit content without touching the file', async (t) => {
  const { dir, older, newer, cleanup } = await revisionFixture();
  t.after(cleanup);
  const value = await gitRepositoryVersion(dir, '', { hash: older, path: 'kept.txt' });
  assert.equal(value.path, 'kept.txt');
  assert.equal(value.hash, older);
  assert.equal(value.content, 'older content\n');
  assert.equal(value.binary, false);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), newer);
  assert.equal(await readFile(join(dir, 'kept.txt'), 'utf8'), 'newer content\n');
});

test('repository version rejects paths absent at that revision and malformed requests', async (t) => {
  const { dir, newer, cleanup } = await revisionFixture();
  t.after(cleanup);
  await assert.rejects(
    () => gitRepositoryVersion(dir, '', { hash: newer, path: 'deleted.txt' }),
    /that revision does not contain this file/,
  );
  await assert.rejects(() => gitRepositoryVersion(dir, '', { hash: '--all', path: 'kept.txt' }), /invalid commit id/);
  await assert.rejects(
    () => gitRepositoryVersion(dir, '', { hash: newer, path: '../outside.txt' }),
    /escapes the workspace/,
  );
});

test('Commit file menu opens a read-only repository version preview', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  const repositoryVersionPreview = await readFile(
    new URL('../src/client/components/diff/RepositoryVersionPreview.tsx', import.meta.url),
    'utf8',
  );
  const menuStart = client.indexOf('const buildCommitFileMenu = React.useCallback');
  const menuEnd = client.indexOf('const buildLogMenu = React.useCallback', menuStart);
  const menu = client.slice(menuStart, menuEnd);

  assert.match(menu, /id: 'openRepositoryVersion'/);
  assert.match(menu, /label: t\('editor\.openRepositoryVersionAction'\)/);
  assert.match(menu, /void openRepositoryVersion\(\{ hash, path \}\)/);
  assert.match(client, /const openRepositoryVersion = React\.useCallback/);
  assert.match(client, /callGit\(\{ op: 'repositoryVersion', hash, path \}\)/);
  assert.match(
    client,
    /repositoryVersion: \{ hash: value\.hash, content: value\.content, binary: value\.binary === true \}/,
  );
  assert.match(repositoryVersionPreview, /function RepositoryVersionPreview\(/);
  assert.match(repositoryVersionPreview, /readOnly: true/);
  assert.match(client, /repositoryVersionTab/);
  assert.match(client, /openRepositoryVersionAction: '按修订显示文件'/);
  assert.match(client, /openRepositoryVersionAction: 'Open Repository Version'/);
  assert.match(host, /async function gitRepositoryVersion\(/);
  assert.match(host, /case 'repositoryVersion':/);
  assert.match(host, /export \{[^}]*gitRepositoryVersion[^}]*\};/);
});
