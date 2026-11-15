import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitStage, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

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
  const fn = new Function(`${extractFunction('pathsScheduledForRemoval')}; return pathsScheduledForRemoval;`)();
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
  assert.ok(source.includes("removeFromVcs: '从 VCS 移除'"));
  assert.ok(source.includes("removeFromVcs: 'Remove from VCS'"));
  assert.match(source, /id: 'removeDeleted'/);
  assert.match(source, /label: t\('editor\.removeFromVcs'\)/);
  assert.match(source, /run: \(\) => void restage\(removablePaths, false\)/);
  assert.doesNotMatch(source, /id: 'removeDeleted'[\s\S]{0,220}shortcut:/);
  assert.match(source, /group\.id === 'unstaged'[\s\S]*?pathsScheduledForRemoval\(/);
  assert.match(source, /id: removalOnlyInGroup \? `removeDeleted:\$\{group\.id\}`/);
});

test('CommitPanel derives its removal map from props instead of the workspace ref', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
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
