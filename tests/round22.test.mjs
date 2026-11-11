import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitStash } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** One commit, then a modified tracked file plus an untracked one. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r22-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\n');
  await writeFile(join(dir, 'brand-new.txt'), 'untracked\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('stash save clears the tree including untracked files', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const saved = await gitStash(dir, { action: 'save', message: 'work in progress' });
  assert.deepEqual(saved.changes, []);
  assert.equal(saved.entries.length, 1);
  assert.match(saved.entries[0].subject, /work in progress/);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'one\n');
  /* `--include-untracked` is the whole point: without it the tree is not clean. */
  await assert.rejects(() => readFile(join(dir, 'brand-new.txt'), 'utf8'));
});

test('stash list is read-only and pop restores both sides', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitStash(dir, { action: 'save' });

  const listed = await gitStash(dir, { action: 'list' });
  assert.equal(listed.entries.length, 1);
  assert.deepEqual(listed.changes, []);

  const popped = await gitStash(dir, { action: 'pop' });
  assert.deepEqual(popped.entries, []);
  assert.deepEqual([...popped.changes.map((change) => change.path)].sort(), ['a.txt', 'brand-new.txt']);
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'one\ntwo\n');
});

test('popping an empty stack says so instead of echoing a git command failure', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  assert.equal((await gitStash(dir, { action: 'list' })).entries.length, 0);
  await assert.rejects(() => gitStash(dir, { action: 'pop' }), /the stash is empty/);
});

test('an unknown sub-action degrades to list and never writes', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitStash(dir, { action: 'rm -rf' });
  assert.equal(value.entries.length, 0);
  /* The dirty tree must still be dirty: nothing was stashed. */
  assert.equal(value.changes.length, 2);
});

test('the commit toolbar offers stash and the panel shows template chips', () => {
  const client = read('lib/client.js');
  assert.match(client, /id: 'stash',\n\s+icon: 'stash'/);
  assert.match(client, /const openStashMenu = React\.useCallback\(/);
  /* The sub-action field is `action`: `op` already names the route operation. */
  /* Round 68 added apply/drop refs, so the request now carries an optional ref. */
  assert.match(client, /callGit\(\{ op: 'stash', action: operation, \.\.\.\(ref === undefined \? \{\} : \{ ref \}\) \}\)/);
  assert.doesNotMatch(client, /op2/);
  assert.match(client, /const COMMIT_TEMPLATES = \['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style'\];/);
  assert.match(client, /templates: COMMIT_TEMPLATES,/);
  assert.match(client, /onTemplate: applyCommitTemplate,/);
});

test('applying a template twice does not stack prefixes', () => {
  const client = read('lib/client.js');
  /* The guard is a strip-then-prefix, so `feat: fix: x` cannot accumulate. */
  assert.ok(client.includes("const match = /^([a-z]+)(\\([^)]*\\))?: ?/u.exec(text);"));
  assert.match(client, /COMMIT_TEMPLATES\.includes\(match\[1\]\) \? text\.slice\(match\[0\]\.length\) : text;/);
  assert.match(client, /return `\$\{prefix\}: \$\{rest\}`;/);
});
