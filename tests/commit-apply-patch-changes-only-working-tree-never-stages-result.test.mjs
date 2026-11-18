import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitApplyPatch, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r325-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

async function trackPatch(dir) {
  await writeFile(join(dir, 'tracked.txt'), 'two\n');
  const patch = git(dir, 'diff', '--binary', '--', 'tracked.txt');
  git(dir, 'checkout', '--', 'tracked.txt');
  return patch;
}

test('Apply Patch changes only the working tree and never stages the result', async (t) => {
  const dir = await fixture();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const patch = await trackPatch(dir);
  const value = await gitApplyPatch(dir, '', { patch });
  assert.deepEqual(value.appliedFiles, ['tracked.txt']);
  assert.equal(readFileSync(join(dir, 'tracked.txt'), 'utf8'), 'two\n');
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '');
  assert.deepEqual(value.changes.map((change) => [change.path, change.status]), [['tracked.txt', ' M']]);
});

test('Apply Patch can create a new workspace file without adding it to the index', async (t) => {
  const dir = await fixture();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'new.txt'), 'new\n');
  git(dir, 'add', 'new.txt');
  const patch = git(dir, 'diff', '--cached', '--binary', '--', 'new.txt');
  git(dir, 'reset', '-q', 'HEAD', '--', 'new.txt');
  await rm(join(dir, 'new.txt'));
  const value = await gitApplyPatch(dir, '', { patch });
  assert.deepEqual(value.appliedFiles, ['new.txt']);
  assert.equal(readFileSync(join(dir, 'new.txt'), 'utf8'), 'new\n');
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '');
  assert.equal(git(dir, 'status', '--short', '--', 'new.txt'), '?? new.txt');
});

test('a conflicting patch is rejected before the working tree changes', async (t) => {
  const dir = await fixture();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const patch = await trackPatch(dir);
  await writeFile(join(dir, 'tracked.txt'), 'local edit\n');
  const beforeStatus = await gitStatus(dir);
  await assert.rejects(() => gitApplyPatch(dir, '', { patch }), /patch preflight failed/iu);
  assert.equal(readFileSync(join(dir, 'tracked.txt'), 'utf8'), 'local edit\n');
  const afterStatus = await gitStatus(dir);
  assert.deepEqual(
    afterStatus.changes.map((change) => [change.path, change.status]),
    beforeStatus.changes.map((change) => [change.path, change.status]),
  );
});

test('a patch outside the current workspace is rejected without writing outside it', async (t) => {
  const base = await fixture();
  const nested = join(base, 'nested');
  await mkdir(nested, { recursive: true });
  await writeFile(join(nested, 'inside.txt'), 'inside\n');
  git(base, 'add', '.');
  git(base, 'commit', '-qm', 'nested');
  await writeFile(join(base, 'top.txt'), 'before\n');
  git(base, 'add', 'top.txt');
  git(base, 'commit', '-qm', 'top');
  await writeFile(join(base, 'top.txt'), 'after\n');
  const patch = git(base, 'diff', '--binary', '--', 'top.txt');
  git(base, 'checkout', '--', 'top.txt');
  t.after(() => rm(base, { recursive: true, force: true }));
  await assert.rejects(
    () => gitApplyPatch(nested, 'nested/', { patch }),
    /does not touch files in this workspace/iu,
  );
  assert.equal(readFileSync(join(base, 'top.txt'), 'utf8'), 'before\n');
});

test('empty and oversized patches fail before spawning git', async () => {
  await assert.rejects(() => gitApplyPatch('/tmp', '', { patch: '  \n' }), /patch is empty/iu);
  await assert.rejects(
    () => gitApplyPatch('/tmp', '', { patch: 'x'.repeat(4 * 1024 * 1024 + 1) }),
    /patch is too large/iu,
  );
});

test('Commit Options exposes both IDEA Apply Patch entry points through one request', () => {
  assert.ok(source.includes("applyPatch: '应用补丁…'"));
  assert.ok(source.includes("applyPatchFromClipboard: '从剪贴板应用补丁…'"));
  assert.ok(source.includes("applyPatch: 'Apply Patch…'"));
  assert.ok(source.includes("applyPatchFromClipboard: 'Apply Patch from Clipboard…'"));
  assert.match(source, /const applyPatchText = React\.useCallback\(/);
  assert.match(source, /op: 'applyPatch',\s*patch/);
  assert.match(source, /id: 'applyPatchFile'/);
  assert.match(source, /id: 'applyPatchClipboard'/);
  assert.match(source, /input\.accept = '\.patch,\.diff,text\/plain'/);
  assert.match(host, /async function gitApplyPatch\(/);
  assert.match(host, /case 'applyPatch':/);
  assert.match(host, /applyPatch supports at most 200 files/);
  assert.match(host, /export \{[^}]*gitApplyPatch/);
});
