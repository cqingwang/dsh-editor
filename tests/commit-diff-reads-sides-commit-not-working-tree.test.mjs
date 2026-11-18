import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCommitDiff, gitFileHistory, gitShowCommit, workspaceFileOperations } from '../lib/index.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readClient = () =>
  readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + read('lib/client.js');

/** A repository with two commits touching the same file. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r17-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'root']);
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'second']);
  const head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const first = execFileSync('git', ['-C', dir, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' }).trim();
  return { dir, head, first, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a commit diff reads both sides from that commit, not the working tree', async (t) => {
  const { dir, head, cleanup } = await fixture();
  t.after(cleanup);
  /* Rewrite the working copy: the preview must ignore it entirely. */
  await writeFile(join(dir, 'a.txt'), 'rewritten\n');

  const diff = await gitCommitDiff(dir, '', { hash: head, path: 'a.txt' });
  assert.equal(diff.original, 'one\n');
  assert.equal(diff.modified, 'one\ntwo\n');
  assert.equal(diff.binary, false);
  assert.equal(diff.path, 'a.txt');

  const detail = await gitShowCommit(dir, head);
  assert.equal(detail.subject, 'second');
});

test('a root commit diffs against an empty tree instead of failing', async (t) => {
  const { dir, first, cleanup } = await fixture();
  t.after(cleanup);
  const diff = await gitCommitDiff(dir, '', { hash: first, path: 'a.txt' });
  assert.equal(diff.original, '');
  assert.equal(diff.modified, 'one\n');
});

test('a commit diff refuses a bad revision or an escaping path', async (t) => {
  const { dir, head, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitCommitDiff(dir, '', { hash: '--all', path: 'a.txt' }), /invalid commit id/);
  await assert.rejects(() => gitCommitDiff(dir, '', { hash: head, path: '../etc/passwd' }), /escapes the workspace/);
  await assert.rejects(() => gitCommitDiff(dir, '', { hash: head, path: '' }), /a path is required/);
});

test('file history follows the path and stays newest first', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const history = await gitFileHistory(dir, 'a.txt');
  assert.deepEqual(history.commits.map((commit) => commit.subject), ['second', 'root']);
  assert.equal(history.path, 'a.txt');
  /* A file nobody committed has an empty history, not an error. */
  await writeFile(join(dir, 'untracked.txt'), 'x\n');
  assert.deepEqual((await gitFileHistory(dir, 'untracked.txt')).commits, []);
  await assert.rejects(() => gitFileHistory(dir, '../etc/passwd'), /escapes the workspace/);
});

test('described paths carry the mtime the editor needs to spot external edits', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r17-stat-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'a.txt'), 'one\n');
  const [entry] = await workspaceFileOperations.describe(dir, ['a.txt']);
  assert.equal(entry.exists, true);
  assert.equal(entry.kind, 'file');
  assert.equal(typeof entry.mtime, 'number');
  assert.equal(entry.size, 4);
  const [missing] = await workspaceFileOperations.describe(dir, ['nope.txt']);
  assert.equal(missing.exists, false);
  assert.equal(missing.mtime, null);
});

test('the editor silently adopts a clean external edit and prompts on a dirty one', () => {
  const client = readClient();
  assert.match(client, /const checkExternalChanges = React\.useCallback\(async \(\) => \{/);
  assert.match(client, /const clean = paths\.filter\(\(path\) => openFilesRef\.current\.find\(\(file\) => file\.path === path\)\?\.dirty !== true\);/);
  /* Programmatic replacement must not fake unsaved work. */
  assert.match(client, /const silentReloadRef = React\.useRef\(new Set\(\)\);/);
  assert.match(client, /if \(silentReloadRef\.current\.has\(activePath\)\) return;/);
  assert.match(client, /t\('editor\.externalChanged'\)/);
  assert.match(client, /const dismissExternal = React\.useCallback\(/);
});

test('commit log opens a commit diff on click and the working copy on double click', () => {
  const client = readClient();
  assert.match(client, /const showCommitDiff = React\.useCallback\(\(target\) => \{/);
  assert.match(client, /setDiffTarget\(\{ path: target\.path, commit: target\.hash, staged: false \}\);/);
  /* `request` first checks a clipboard target, then commit, then staged. */
  assert.match(client, /typeof target\.clipboardText === 'string'\s+\? \{\s+op: 'compareText'/u);
  assert.match(client, /typeof target\.commit === 'string'\s+\? \{\s+op: 'commitDiff'/u);
  assert.match(client, /op: 'commitDiff',\s+hash: target\.commit,\s+path: target\.path,/u);
  assert.match(client, /onDoubleClick: \(\) => \{[\s\S]*?if \(localExists\) onEditSource\?\.\(file\.path\);/);
  /* The tree can jump straight to one file's history. */
  assert.match(client, /id: 'history',\n\s+label: t\('editor\.showHistory'\)/);
});

test('terminal clears with the IDEA shortcut and tabs move between panes', () => {
  const client = readClient();
  assert.match(client, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(client, /const emulator = focusedPaneRef\.current === 'right' \? splitEmulatorRef\.current : emulatorRef\.current;/);
  assert.match(client, /const moveToPane = React\.useCallback\(/);
  assert.match(client, /moveToPane\(source, 'right'\)/);
  assert.match(client, /moveToPane\(source, 'left'\)/);
});

test('external-change helpers are declared before anything lists them as a dependency', () => {
  const client = readClient();
  /* A TDZ error here blanks the whole editor, so the order is part of the contract. */
  const dismissAt = client.indexOf('const dismissExternal = React.useCallback(');
  const reloadAt = client.indexOf('const reloadActiveFromDisk = React.useCallback(');
  const checkAt = client.indexOf('const checkExternalChanges = React.useCallback(');
  assert.ok(dismissAt > 0 && reloadAt > dismissAt, 'dismissExternal must precede reloadActiveFromDisk');
  assert.ok(checkAt > reloadAt, 'checkExternalChanges must follow the reload helpers');
});

test('the log tab stacks list over details instead of two thin columns', () => {
  const client = readClient();
  assert.match(client, /commitLogBody: \{/);
  assert.match(client, /commitLogList: \{/);
  assert.match(client, /commitLogDetail: \{/);
  /* The tool window is narrow; side-by-side panes left both unreadable. */
  assert.match(client, /flexDirection: 'column',\n\s+flex: '0 0 46%'/);
});
