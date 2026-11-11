import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCreateTag } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r66-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'a.txt'), '1\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'first');
  await writeFile(join(dir, 'a.txt'), '2\n');
  git(dir, 'commit', '-qam', 'second');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a tag is created on the chosen commit and appears in the tag list', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const first = git(dir, 'rev-parse', 'HEAD~1');
  const value = await gitCreateTag(dir, { name: 'v0.1.0', hash: first });
  assert.equal(git(dir, 'rev-parse', 'v0.1.0^{commit}'), first);
  assert.ok(value.tagList.some((tag) => tag.name === 'v0.1.0'));
  /* HEAD never moves when tagging an older commit. */
  assert.equal(git(dir, 'rev-parse', 'HEAD'), git(dir, 'rev-parse', 'main'));
});

test('without a hash the tag lands on HEAD', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitCreateTag(dir, { name: 'head-tag' });
  assert.equal(git(dir, 'rev-parse', 'head-tag^{commit}'), git(dir, 'rev-parse', 'HEAD'));
});

test('bad tag names, unknown revisions and duplicates are refused before git', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitCreateTag(dir, { name: '' }), /a tag name is required/u);
  await assert.rejects(() => gitCreateTag(dir, { name: '--contains' }), /may not start with/u);
  await assert.rejects(() => gitCreateTag(dir, { name: 'a b' }), /spaces/u);
  await assert.rejects(() => gitCreateTag(dir, { name: 'x', hash: 'main' }), /invalid commit id/u);
  await assert.rejects(() => gitCreateTag(dir, { name: 'x', hash: '--all' }), /invalid commit id/u);
  await gitCreateTag(dir, { name: 'dup' });
  await assert.rejects(() => gitCreateTag(dir, { name: 'dup' }), /already exists/u);
});

test('the log menu offers Create Tag and the client prompts for a name', () => {
  const client = read('lib/client.js');
  const start = client.indexOf('const buildLogMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = client.slice(start, start + 2200);
  assert.match(block, /t\('editor\.createTagAction'\)/);
  assert.match(block, /kind: 'tag'/);
  assert.match(client, /if \(namePrompt\.kind === 'tag'\)/);
});

test('the host routes tag creation and exports it', () => {
  const host = read('lib/index.js');
  assert.match(host, /case 'createTag':\s+return ok\(await gitCreateTag\(root, body\)\);/);
  assert.match(host, /export \{[\s\S]*gitCreateTag[\s\S]*\};/);
});
