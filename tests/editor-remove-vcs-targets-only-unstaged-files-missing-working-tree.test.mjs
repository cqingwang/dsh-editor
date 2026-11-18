import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

import { gitStage, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const locales = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
const gitChangeModelSource = readFileSync(join(root, 'src/client/components/ui/git-change-model.ts'), 'utf8');

async function deletedFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r323-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'deleted.txt'), 'delete me\n');
  await writeFile(join(dir, 'other.txt'), 'keep me\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  await rm(join(dir, 'deleted.txt'));
  return dir;
}

test('Remove from VCS targets only unstaged files missing from the working tree', () => {
  const fn = loadTypeScriptFunction(gitChangeModelSource, 'pathsScheduledForRemoval');
  const changes = new Map([
    ['deleted.txt', { status: ' D' }],
    ['partly-staged.txt', { status: 'MD' }],
    ['already-staged.txt', { status: 'D ' }],
    ['both-deleted.txt', { status: 'DD' }],
    ['modified.txt', { status: ' M' }],
    ['untracked.txt', { status: '??' }],
  ]);
  const selected = [...changes.keys()].map((path) => ({ path, staged: false }));
  assert.deepEqual(fn(selected, changes), ['deleted.txt', 'partly-staged.txt']);
});

test('Remove from VCS is exposed with IDEA wording and no invented shortcut', () => {
  assert.ok(locales.includes("removeFromVcs: '从 VCS 移除'"));
  assert.ok(locales.includes("removeFromVcs: 'Remove from VCS'"));
  assert.match(source, /id: 'removeDeleted'/);
  assert.match(source, /label: t\('editor\.removeFromVcs'\)/);
  assert.match(source, /run: \(\) => onStage\(removableInGroup\)/);
  assert.doesNotMatch(source, /id: 'removeDeleted'[\s\S]{0,220}shortcut:/);
  assert.match(source, /group\.id === 'unstaged'[\s\S]*?pathsScheduledForRemoval\(/);
  assert.match(source, /id: removalOnlyInGroup \? `removeDeleted:\$\{group\.id\}`/);
});

test('CommitPanel derives its removal map from props instead of the workspace ref', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('export { CommitPanel };'));
  assert.match(panel, /const changesByPath = new Map\(changes\.map\(\(change\) => \[change\.path, change\]\)\)/);
  assert.doesNotMatch(panel, /changesByPathRef/);
});

test('scheduling a deleted path stages the deletion without recreating or deleting other files', async (t) => {
  const dir = await deletedFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await gitStage(dir, { paths: ['deleted.txt'], staged: false });
  const status = await gitStatus(dir);
  assert.deepEqual(
    status.changes.map((change) => [change.path, change.status]),
    [['deleted.txt', 'D ']],
  );
  await assert.rejects(() => access(join(dir, 'deleted.txt')));
  assert.equal(await readFileSync(join(dir, 'other.txt'), 'utf8'), 'keep me\n');
  assert.equal(execFileSync('git', ['-C', dir, 'diff', '--cached', '--name-status'], { encoding: 'utf8' }).trim(), 'D\tdeleted.txt');
});
