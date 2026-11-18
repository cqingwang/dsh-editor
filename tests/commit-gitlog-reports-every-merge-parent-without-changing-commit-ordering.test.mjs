import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

import { gitLog } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function mergeFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-log-navigation-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'root.txt'), 'root\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'root');
  git(dir, 'checkout', '-qb', 'side');
  await writeFile(join(dir, 'side.txt'), 'side\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'side');
  git(dir, 'checkout', '-q', 'main');
  await writeFile(join(dir, 'main.txt'), 'main\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'main');
  git(dir, 'merge', '--no-ff', 'side', '-m', 'merge side');
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

test('gitLog reports every merge parent without changing commit ordering', async (t) => {
  const { dir, cleanup } = await mergeFixture();
  t.after(cleanup);
  const commits = await gitLog(dir, 10);
  const merge = commits.find((commit) => commit.subject === 'merge side');
  assert.ok(merge);
  assert.equal(merge.parents.length, 2);
  assert.deepEqual(commits.slice(1).map((commit) => commit.subject).sort(), ['main', 'root', 'side']);
});

test('commitRelationTargets finds loaded parents, children and merge branches', async () => {
  const client = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
  const fn = loadTypeScriptFunction(client, 'commitRelationTargets');
  const entries = [
    { hash: 'merge', parents: ['main', 'side'], subject: 'merge' },
    { hash: 'main', parents: ['root'], subject: 'main' },
    { hash: 'side', parents: ['root'], subject: 'side' },
    { hash: 'root', parents: [], subject: 'root' },
  ];

  assert.deepEqual(fn(entries, 'merge').parents.map((entry) => entry.hash), ['main', 'side']);
  assert.deepEqual(fn(entries, 'merge').children, []);
  assert.deepEqual(fn(entries, 'root').children.map((entry) => entry.hash), ['main', 'side']);
  assert.deepEqual(fn(entries, 'missing'), { parents: [], children: [] });
});

test('Relation navigation chooses the first visible target for arrow-key actions', async () => {
  const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
  const commitRelationTargets = loadTypeScriptFunction(source, 'commitRelationTargets');
  const fn = new Function(
    `${commitRelationTargets.toString()}; ${loadTypeScriptFunction(source, 'commitRelationTarget').toString()}; return commitRelationTarget;`,
  )();
  const entries = [
    { hash: 'child', parents: ['middle'] },
    { hash: 'middle', parents: ['parent'] },
    { hash: 'parent', parents: [] },
  ];

  assert.equal(fn(entries, 'middle', 'parents')?.hash, 'parent');
  assert.equal(fn(entries, 'middle', 'children')?.hash, 'child');
  assert.equal(fn(entries, 'parent', 'parents'), null);
  assert.equal(fn(entries, 'child', 'children'), null);
});

test('Commit Log exposes parent and child actions and wires IDEA arrow keys', async () => {
  const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/client/components/commit/log-menu.ts', import.meta.url), 'utf8');
  const commandModel = await readFile(
    new URL('../src/client/components/commit/commit-log-list-command-model.ts', import.meta.url),
    'utf8',
  );
  const commitLog = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');
  const graphController = await readFile(
    new URL('../src/client/components/commit/commit-log-graph-controller.ts', import.meta.url),
    'utf8',
  );
  const flatController = await readFile(
    new URL('../src/client/components/commit/commit-log-flat-controller.ts', import.meta.url),
    'utf8',
  );
  const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

  assert.match(menu, /id: 'goToParentCommit'/);
  assert.match(menu, /id: 'goToChildCommit'/);
  assert.match(menu, /label: t\('editor\.goToParentCommitAction'\)/);
  assert.match(menu, /label: t\('editor\.goToChildCommitAction'\)/);
  assert.match(menu, /shortcut: '→'/);
  assert.match(menu, /shortcut: '←'/);
  assert.match(menu, /disabled: parentTargets\.length === 0/);
  assert.match(menu, /disabled: childTargets\.length === 0/);
  assert.match(locales, /goToParentCommitAction: '转到父提交'/);
  assert.match(locales, /goToChildCommitAction: '转到子提交'/);
  assert.match(locales, /goToParentCommitAction: 'Go to Parent Commit'/);
  assert.match(locales, /goToChildCommitAction: 'Go to Child Commit'/);
  assert.match(commandModel, /intent\.type === 'relation'/);
  assert.match(commitLog, /command\?\.type === 'relation'[\s\S]*?commitRelationTarget\(visible, selected, command\.direction\)/);
  assert.match(graphController, /if \(key === 'ArrowRight'\) return \{ type: 'relation', direction: 'parents' \}/);
  assert.match(flatController, /if \(key === 'ArrowRight'\) return \{ type: 'relation', direction: 'parents' \}/);
  assert.match(host, /--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1f%P%x1e/);
  assert.match(host, /parents: parents === '' \? \[\]/);
});
