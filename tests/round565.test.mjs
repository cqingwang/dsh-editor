import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

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

function extractFunction(source, name) {
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
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const fn = new Function(`${extractFunction(client, 'commitRelationTargets')}; return commitRelationTargets;`)();
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
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const fn = new Function(
    `${extractFunction(client, 'commitRelationTargets')}; ${extractFunction(client, 'commitRelationTarget')}; return commitRelationTarget;`,
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
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  const menuStart = client.indexOf('const buildLogMenu = React.useCallback');
  const menuEnd = client.indexOf('/* Rollback discards edits', menuStart);
  const menu = client.slice(menuStart, menuEnd);

  assert.match(menu, /id: 'goToParentCommit'/);
  assert.match(menu, /id: 'goToChildCommit'/);
  assert.match(menu, /label: t\('editor\.goToParentCommitAction'\)/);
  assert.match(menu, /label: t\('editor\.goToChildCommitAction'\)/);
  assert.match(menu, /shortcut: '→'/);
  assert.match(menu, /shortcut: '←'/);
  assert.match(menu, /disabled: parentTargets\.length === 0/);
  assert.match(menu, /disabled: childTargets\.length === 0/);
  assert.match(client, /goToParentCommitAction: '转到父提交'/);
  assert.match(client, /goToChildCommitAction: '转到子提交'/);
  assert.match(client, /goToParentCommitAction: 'Go to Parent Commit'/);
  assert.match(client, /goToChildCommitAction: 'Go to Child Commit'/);
  const graphKeys = client.slice(
    client.indexOf('commitLogGraphListCommand('),
    client.indexOf("if (command?.type === 'move')", client.indexOf('commitLogGraphListCommand(')),
  );
  assert.match(graphKeys, /command\?\.type === 'relation'[\s\S]*?commitRelationTarget\([\s\S]*?command\.direction/);
  const flatKeys = client.slice(
    client.indexOf('commitLogFlatListCommand('),
    client.indexOf("if (command?.type !== 'row')", client.indexOf('commitLogFlatListCommand(')),
  );
  assert.match(flatKeys, /command\?\.type === 'relation'[\s\S]*?commitRelationTarget\(visible, selected, command\.direction\)/);
  assert.match(client, /if \(key === 'ArrowRight'\) return \{ type: 'relation', direction: 'parents' \}/);
  assert.match(host, /--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1f%P%x1e/);
  assert.match(host, /parents: parents === '' \? \[\]/);
});
