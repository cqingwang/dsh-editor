import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitStash } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r68-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'tracked.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'root');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a stash list is newest-first and each entry names its own ref', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  await gitStash(dir, { action: 'save', message: 'first' });
  await writeFile(join(dir, 'tracked.txt'), 'two\n');
  const listed = await gitStash(dir, { action: 'save', message: 'second' });
  assert.equal(listed.entries.length, 2);
  assert.equal(listed.entries[0].ref, 'stash@{0}');
  assert.equal(listed.entries[1].ref, 'stash@{1}');
  assert.match(listed.entries[0].subject, /second/u);
});

test('apply keeps the entry, drop removes it', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'stashed content\n');
  await gitStash(dir, { action: 'save', message: 'keep me' });

  /* Apply restores the work but leaves the stash on the stack (IDEA's "Apply"). */
  const applied = await gitStash(dir, { action: 'apply', ref: 'stash@{0}' });
  assert.equal(applied.entries.length, 1);
  assert.equal(git(dir, 'status', '--porcelain'), 'M tracked.txt');
  assert.equal(await readFileUtf8(join(dir, 'tracked.txt')), 'stashed content\n');

  /* Reset the tree so the entry is droppable without conflicts, then drop it. */
  git(dir, 'checkout', '--', 'tracked.txt');
  const dropped = await gitStash(dir, { action: 'drop', ref: 'stash@{0}' });
  assert.equal(dropped.entries.length, 0);
});

test('an unknown or hostile stash ref is refused before git runs', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'x\n');
  await gitStash(dir, { action: 'save' });
  await assert.rejects(() => gitStash(dir, { action: 'apply', ref: 'stash@{9}' }), /no such stash/u);
  await assert.rejects(() => gitStash(dir, { action: 'apply', ref: '--index' }), /no such stash/u);
  await assert.rejects(() => gitStash(dir, { action: 'drop', ref: '' }), /no such stash/u);
  /* The real entry is untouched by the refusals. */
  const listed = await gitStash(dir, { action: 'list' });
  assert.equal(listed.entries.length, 1);
});

test('the stash menu lists entries with apply and drop', () => {
  const client = read('src/client/editor-workspace.tsx');
  const menu = read('src/client/components/commit/stash-shelve-menu.ts');
  const start = client.indexOf('const openStashMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = client.slice(start, start + 2600);
  assert.match(menu, /t\('editor\.stashApply'/);
  assert.match(menu, /t\('editor\.stashDrop'/);
  assert.match(menu, /onRunStash\('apply', entry\.ref\)/);
  assert.match(menu, /onRunStash\('drop', entry\.ref\)/);
  assert.match(block, /onRunStash: \(operation, ref\) => void runStash\(operation, ref\)/);
});

test('the host accepts the two new actions', () => {
  const host = read('lib/index.js');
  /* One whitelist decides the operation; an unknown action falls back to `list`
     instead of reaching git. */
  assert.match(host, /const operation = \['save', 'pop', 'apply', 'drop'\]\.includes\(requested\) \? requested : 'list';/u);
  /* The ref is validated against the real stack, never pasted into argv. */
  assert.match(host, /if \(wanted === '' \|\| !refs\.includes\(wanted\)\)/u);
});

/** Read a file as UTF-8 (kept local so the test does not import fs promises twice). */
async function readFileUtf8(path) {
  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}
