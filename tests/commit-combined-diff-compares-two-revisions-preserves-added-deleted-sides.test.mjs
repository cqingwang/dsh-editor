import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

import { gitCombinedDiff } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function revisionPairFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-compare-revisions-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'changed.txt'), 'older changed\n');
  await writeFile(join(dir, 'deleted.txt'), 'older deleted\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'older');
  const older = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'changed.txt'), 'newer changed\n');
  await unlink(join(dir, 'deleted.txt'));
  await writeFile(join(dir, 'added.txt'), 'newer added\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'newer');
  return { dir, older, newer: git(dir, 'rev-parse', 'HEAD'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('combined diff compares two revisions and preserves added/deleted sides', async (t) => {
  const { dir, older, newer, cleanup } = await revisionPairFixture();
  t.after(cleanup);
  const value = await gitCombinedDiff(dir, '', {
    entries: [
      { path: 'changed.txt', originalRevision: older, modifiedRevision: newer, heading: 'changed' },
      { path: 'deleted.txt', originalRevision: older, modifiedRevision: newer, heading: 'deleted' },
      { path: 'added.txt', originalRevision: older, modifiedRevision: newer, heading: 'added' },
    ],
  });
  const changed = value.files.find((file) => file.path === 'changed.txt');
  const deleted = value.files.find((file) => file.path === 'deleted.txt');
  const added = value.files.find((file) => file.path === 'added.txt');

  assert.match(value.original, /older changed/);
  assert.match(value.modified, /newer changed/);
  assert.match(value.original, /older deleted/);
  assert.doesNotMatch(value.modified, /older deleted/);
  assert.doesNotMatch(value.original, /newer added/);
  assert.match(value.modified, /newer added/);
  assert.equal(changed?.missing, false);
  assert.equal(deleted?.missing, true);
  assert.equal(added?.headExists, false);
  assert.equal(value.files.length, 3);
});

test('log selection supports toggle and inclusive shift ranges', async () => {
  const source = await readFile(
    new URL('../src/client/components/commit/commit-log-selection-model.ts', import.meta.url),
    'utf8',
  );
  const fn = loadTypeScriptFunction(source, 'commitSelectionAfterClick');
  const order = ['newest', 'middle', 'oldest'];

  assert.deepEqual(fn(order, ['middle'], 'newest', {}), { selected: ['newest'], anchor: 'newest' });
  assert.deepEqual(fn(order, ['middle'], 'newest', { meta: true }), { selected: ['middle', 'newest'], anchor: 'newest' });
  assert.deepEqual(fn(order, ['middle'], 'oldest', { shift: true }, 'newest'), {
    selected: ['newest', 'middle', 'oldest'],
    anchor: 'newest',
  });
  assert.deepEqual(fn(order, ['middle'], 'newest', { shift: true }, 'not-loaded'), {
    selected: ['newest'],
    anchor: 'newest',
  });
});

test('compare selection orders the older revision on the left', async () => {
  const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
  const fn = loadTypeScriptFunction(source, 'orderedRevisionPair');
  const entries = [
    { hash: 'newest', parents: ['middle'] },
    { hash: 'middle', parents: ['oldest'] },
    { hash: 'oldest', parents: [] },
  ];

  assert.deepEqual(fn(['oldest', 'newest'], entries), ['newest', 'oldest']);
  assert.deepEqual(fn(['middle', 'oldest'], entries), ['middle', 'oldest']);
  assert.equal(fn(['middle'], entries), null);
});

test('Commit Log exposes Compare Revisions for exactly two selected commits', async () => {
  const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/client/components/commit/log-menu.ts', import.meta.url), 'utf8');
  const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
  const actionStart = client.indexOf('const compareCommitRevisions = React.useCallback');
  const actionEnd = client.indexOf('const compareCommitWithLocal = React.useCallback', actionStart);
  const action = client.slice(actionStart, actionEnd);

  assert.match(menu, /id: 'compareRevisions'/);
  assert.match(menu, /label: t\('editor\.compareRevisionsAction'\)/);
  assert.match(menu, /selectionHashes\.length === 2/);
  assert.match(action, /orderedRevisionPair\(selectionHashes, loadedEntries\)/);
  assert.match(action, /originalRevision: leftHash/);
  assert.match(action, /modifiedRevision: rightHash/);
  assert.match(action, /revisionPair:/);
  assert.match(locales, /compareRevisionsAction: '比较版本'/);
  assert.match(locales, /compareRevisionsAction: 'Compare Revisions'/);
  assert.match(client, /target\?\.revisionPair/);
});
