import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitSelectedPatch, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r321-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');
  execFileSync('git', ['-C', dir, 'add', 'tracked.txt']);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\nthree\n');
  await writeFile(join(dir, 'new.txt'), 'new\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('selected patch includes staged, unstaged and untracked changes', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const before = await gitStatus(dir);
  const value = await gitSelectedPatch(dir, before.prefix, {
    entries: [
      { path: 'tracked.txt', staged: true },
      { path: 'tracked.txt', staged: false },
      { path: 'new.txt', staged: false },
    ],
  });
  assert.equal(value.files.length, 3);
  assert.match(value.patch, /diff --git a\/tracked\.txt b\/tracked\.txt/u);
  assert.match(value.patch, /new file mode 100644/u);
  assert.match(value.patch, /\+new/u);
  const headers = value.patch.match(/^diff --git /gmu) ?? [];
  assert.equal(headers.length, 3);
  const after = await gitStatus(dir);
  assert.deepEqual(after.changes.map((change) => [change.path, change.status]), before.changes.map((change) => [change.path, change.status]));
});

test('patch host operation is bounded and never creates intent-to-add entries', () => {
  assert.match(host, /async function gitSelectedPatch\(/);
  assert.match(host, /patch supports at most 100 files/);
  assert.match(host, /diff', '--no-index'/);
  assert.match(host, /case 'patch':/);
  assert.match(host, /export \{[^}]*gitSelectedPatch/);
});

test('Commit exposes Copy as Patch and writes host text to the clipboard', () => {
  assert.ok(source.includes("copyPatchToClipboard: '作为补丁复制到剪贴板'"));
  assert.ok(source.includes("copyPatchToClipboard: 'Copy as Patch to Clipboard'"));
  assert.ok(source.includes("patchCopied: '已复制 {count} 个文件的补丁'"));
  assert.ok(source.includes("patchCopied: 'Copied a patch for {count} file(s)'"));
  assert.match(source, /op: 'patch', entries/);
  assert.match(source, /navigator\.clipboard\?\.writeText\(value\.patch\)/);
  assert.match(source, /id: 'copyPatch'/);
  assert.match(source, /id: 'copyPatchToClipboard'/);
});
