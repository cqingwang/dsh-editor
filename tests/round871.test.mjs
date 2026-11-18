import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const findTool = await read('src/client/find-tool.ts');
const helpers = loadTypeScriptModule(findTool, [
  'assignGraphLanes',
  'commitLocalDiffEntries',
  'findSearchOptionShortcutAction',
  'findScopeGlobMatches',
  'findToolReplaceAdvanceIndex',
  'fuzzyScore',
  'graphDisplayEntries',
  'linearRun',
  'normalizeFileExtensionFilter',
  'orderedRevisionPair',
  'overflowTabs',
  'pasteHistoryPreview',
  'pushPasteHistory',
  'reorderTabPaths',
  'visibleTabCount',
  'wholeWordIndex',
]);

test('TypeScript find-tool preserves search and scope matching behavior', () => {
  assert.equal(helpers.findToolReplaceAdvanceIndex([{ rowKey: 'text:a' }, { rowKey: 'text:b' }], 'text:a', 1), 1);
  assert.equal(helpers.findToolReplaceAdvanceIndex([], '', 0), 0);
  assert.equal(helpers.findSearchOptionShortcutAction({ key: 'c', ctrlKey: true }), 'case');
  assert.equal(helpers.findSearchOptionShortcutAction({ key: 'Backspace', altKey: true, shiftKey: true }), 'clear');
  assert.equal(helpers.wholeWordIndex('find usages', 'usages'), 5);
  assert.equal(helpers.wholeWordIndex('findusages', 'usages'), -1);
  assert.equal(helpers.normalizeFileExtensionFilter('ts, .md, !vendor/**'), '*.ts,*.md,!vendor/**');
  assert.equal(helpers.findScopeGlobMatches('src/nested/app.ts', 'src/**'), true);
  assert.equal(helpers.findScopeGlobMatches('docs/readme.md', 'src/**'), false);
  assert.ok(helpers.fuzzyScore('src/app.ts', 'app') > 0);
  assert.equal(helpers.fuzzyScore('src/app.ts', 'zzz'), -1);
});

test('TypeScript find-tool preserves graph, commit and tab helpers', () => {
  const graph = [
    { hash: 'c', parents: ['b'] },
    { hash: 'b', parents: ['a'] },
    { hash: 'a', parents: [] },
  ];
  const lanes = helpers.assignGraphLanes(graph);
  assert.equal(lanes.laneCount, 1);
  assert.equal(lanes.laneOf.get('a'), 0);
  assert.deepEqual(
    helpers.linearRun(graph, lanes.laneOf).map((run) => run.hashes),
    [['c', 'b', 'a']],
  );
  assert.deepEqual(helpers.graphDisplayEntries(graph, true), [graph[0]]);
  assert.deepEqual(helpers.orderedRevisionPair(['a', 'c'], graph), ['c', 'a']);
  assert.deepEqual(helpers.commitLocalDiffEntries({ files: [{ path: 'src/app.ts' }] }, 'abcdef123'), [
    {
      path: 'src/app.ts',
      revision: 'abcdef123',
      heading: 'src/app.ts · abcdef1 → local',
    },
  ]);
  assert.equal(helpers.visibleTabCount(1000, 3), 3);
  assert.equal(helpers.visibleTabCount(100, 3), 1);
  const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(helpers.overflowTabs(tabs, 2, 'c'), {
    visible: [{ id: 'a' }, { id: 'c' }],
    hidden: [{ id: 'b' }],
  });
  assert.deepEqual(helpers.reorderTabPaths(tabs, 'a', 'c', false), [{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  assert.deepEqual(helpers.pushPasteHistory(['old', 'same'], 'same'), ['same', 'old']);
  assert.equal(helpers.pasteHistoryPreview('a\nb'), 'a↵b');
});

test('find-tool.js is deleted from source and frozen as a test oracle', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/find-tool.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/find-tool.legacy.js', import.meta.url)), true);
  assert.match(build, /'find-tool\.ts'/u);
  assert.doesNotMatch(build, /'find-tool\.js'/u);
  assert.match(client, /\/\* ─────────────────────── find-tool\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── find-tool\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/find-tool.js.bak', import.meta.url)), false);
});
