import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitShelve } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const options = readFileSync(join(root, 'src/client/components/commit/commit-options-menu.ts'), 'utf8');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r179-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  await writeFile(join(dir, 'a.txt'), 'base\n');
  await writeFile(join(dir, 'b.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  /* a.txt becomes MM: one staged hunk and one worktree-only hunk. */
  await writeFile(join(dir, 'a.txt'), 'base\nstaged\n');
  git(dir, 'add', 'a.txt');
  await writeFile(join(dir, 'a.txt'), 'base\nstaged\nworktree\n');
  /* b.txt stays selected-out, proving the shelf is path scoped. */
  await writeFile(join(dir, 'b.txt'), 'base\nunselected\n');
  await writeFile(join(dir, 'new.txt'), 'untracked\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('shelving selected paths leaves the rest of the tree untouched', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const saved = await gitShelve(dir, {
    action: 'save',
    paths: ['a.txt', 'new.txt'],
    message: 'dsh-editor-shelve: selected',
  });
  assert.equal(saved.entries.length, 1);
  assert.equal(git(dir, 'status', '--porcelain'), 'M b.txt');
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'base\n');
  await assert.rejects(() => readFile(join(dir, 'new.txt'), 'utf8'));
  assert.equal(await readFile(join(dir, 'b.txt'), 'utf8'), 'base\nunselected\n');
});

test('unshelve restores index and worktree independently', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitShelve(dir, { action: 'save', paths: ['a.txt', 'new.txt'], message: 'dsh-editor-shelve: selected' });
  const applied = await gitShelve(dir, { action: 'apply', ref: 'stash@{0}' });
  assert.equal(applied.entries.length, 1);
  assert.equal(git(dir, 'status', '--porcelain'), 'MM a.txt\n M b.txt\n?? new.txt');
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'base\nstaged\nworktree\n');
  assert.equal(await readFile(join(dir, 'new.txt'), 'utf8'), 'untracked\n');
});

test('dropping a shelf removes only that shelf entry', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitShelve(dir, { action: 'save', paths: ['a.txt'], message: 'dsh-editor-shelve: one' });
  const dropped = await gitShelve(dir, { action: 'drop', ref: 'stash@{0}' });
  assert.deepEqual(dropped.entries, []);
  assert.equal(git(dir, 'status', '--porcelain'), 'M b.txt\n?? new.txt');
});

test('unknown and hostile shelf refs are refused before git runs', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitShelve(dir, { action: 'save', paths: ['a.txt'], message: 'dsh-editor-shelve: one' });
  await assert.rejects(() => gitShelve(dir, { action: 'apply', ref: 'stash@{7}' }), /no such shelf/u);
  await assert.rejects(() => gitShelve(dir, { action: 'drop', ref: '--index' }), /no such shelf/u);
  assert.equal((await gitShelve(dir, { action: 'list' })).entries.length, 1);
});

test('an empty path selection is refused instead of shelving everything', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitShelve(dir, { action: 'save', paths: [] }), /select at least one file/u);
  assert.equal(git(dir, 'status', '--porcelain'), 'MM a.txt\n M b.txt\n?? new.txt');
});

test('the Commit toolbar exposes Shelve and restores with the index-aware action', () => {
  assert.match(
    options,
    /id: 'shelve',\n\s+label: t\('editor\.shelve'\),\n\s+disabled: gitNotManaged \|\| commitBusy \|\| updateBusy,\n\s+run: onShelve/,
  );
  const run = source.slice(
    source.indexOf('const runShelve = React.useCallback('),
    source.indexOf('const openStashMenu = React.useCallback('),
  );
  assert.match(run, /op: 'shelve'/);
  assert.match(run, /action: operation/);
  assert.match(run, /Array\.isArray\(paths\) \? \{ paths \}/);
  const menuSource = readFileSync(join(root, 'src/client/components/commit/stash-shelve-menu.ts'), 'utf8');
  const menu = source.slice(
    source.indexOf('const openShelveMenu = React.useCallback('),
    source.indexOf('/* Batch delete for the Project tool window'),
  );
  assert.match(menu, /const selected = \[\.\.\.commitSelection\]/);
  assert.match(menu, /onRunShelve: \(operation, ref, paths\) => void runShelve\(operation, ref, paths\)/);
  assert.match(menuSource, /onRunShelve\('save', undefined, selectedPaths\)/);
  assert.match(menuSource, /onRunShelve\('apply', entry\.ref\)/);
  assert.match(menuSource, /onRunShelve\('drop', entry\.ref\)/);
});

test('the Commit Rollback action follows the whole visible selection', () => {
  const panel = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
  assert.match(panel, /chosenChangeList = \[\]/);
  assert.match(panel, /chosenChangeList\.length > 1/);
  assert.match(panel, /onRollbackSelected\?\.\(chosenChangeList\)/);
  assert.match(source, /chosenChangeList=\{chosenChanges\(selectedChange\)\}/);
  const wiring = source.slice(
    source.indexOf('onRollbackSelected={(picked) => {'),
    source.indexOf(
      'onStage={(paths) => void restage(paths, false)',
      source.indexOf('onRollbackSelected={(picked) => {'),
    ),
  );
  assert.match(wiring, /picked\.map\(\(entry\) => entry\.path\)/);
  assert.match(wiring, /new Set\(/);
  assert.match(wiring, /void rollback\(selected, \{ all: true \}\)/);
});
