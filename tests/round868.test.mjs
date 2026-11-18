import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const diff = await read('src/client/diff.ts');
const helpers = loadTypeScriptModule(diff, [
  'diffDirectActionCountForWidth',
  'diffFileNavModeForWidth',
  'diffIncludedSummaryState',
  'groupDiffToolbarActions',
  'revealCollapseKeys',
  'splitChanges',
  'stageAllTargets',
]);

test('TypeScript Diff helpers preserve staged, toolbar and navigation behavior', () => {
  const changes = [
    { path: 'staged.ts', status: 'M ' },
    { path: 'working.ts', status: ' M' },
    { path: 'both.ts', status: 'MM' },
    { path: 'new.ts', status: '??' },
  ];
  const bands = helpers.splitChanges(changes);
  assert.deepEqual(
    bands.staged.map((change) => change.path),
    ['staged.ts', 'both.ts'],
  );
  assert.deepEqual(
    bands.unstaged.map((change) => change.path),
    ['working.ts', 'both.ts'],
  );
  assert.deepEqual(
    bands.unversioned.map((change) => change.path),
    ['new.ts'],
  );
  assert.deepEqual(helpers.stageAllTargets(changes, false), ['working.ts', 'both.ts', 'new.ts']);
  assert.deepEqual(helpers.stageAllTargets(changes, true), ['working.ts', 'both.ts']);

  const actions = [
    { id: 'view', group: 'mode' },
    { id: 'swap', group: 'mode' },
    { id: 'reload', group: 'inspect' },
  ];
  assert.deepEqual(
    helpers.groupDiffToolbarActions(actions).map((entry) => entry?.id ?? null),
    ['view', 'swap', null, 'reload'],
  );
  assert.equal(helpers.diffDirectActionCountForWidth(1200, 220, actions), actions.length);
  assert.equal(helpers.diffFileNavModeForWidth(150), 'hidden');
  assert.equal(helpers.diffFileNavModeForWidth(180), 'compact');
  assert.equal(helpers.diffFileNavModeForWidth(320), 'full');
  assert.equal(helpers.diffIncludedSummaryState(3, true), 'all');
  assert.equal(helpers.diffIncludedSummaryState(3, false), 'none');
  assert.equal(helpers.diffIncludedSummaryState(0, true), null);
  assert.deepEqual(helpers.revealCollapseKeys('unversioned', 'src/nested/file.ts'), [
    'unversioned:',
    'unversioned:src',
    'unversioned:src/nested',
  ]);
});

test('diff.js is deleted from source and frozen as a test oracle', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/diff.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/diff.legacy.js', import.meta.url)), true);
  assert.match(build, /'diff\.ts'/u);
  assert.doesNotMatch(build, /'diff\.js'/u);
  assert.match(client, /\/\* ─────────────────────── diff\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── diff\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/diff.js.bak', import.meta.url)), false);
});
