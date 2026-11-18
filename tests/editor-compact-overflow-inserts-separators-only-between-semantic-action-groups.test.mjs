import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource } from './ui-sources.mjs';

const source = ((await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'))) + '\n' + await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

const groupCompactActions = new Function(
  `${extract('groupCompactActions')}\nreturn groupCompactActions;`,
)();

test('compact overflow inserts separators only between semantic action groups', () => {
  const actions = [
    { id: 'refresh', group: 'refresh' },
    { id: 'rollback', group: 'local' },
    { id: 'showDiff', group: 'diff' },
    { id: 'combinedDiff', group: 'diff' },
    { id: 'copyPatch', group: 'patch' },
    { id: 'createPatch', group: 'patch' },
    { id: 'stageAllTracked', group: 'local' },
    { id: 'viewOptions', group: 'view' },
    { id: 'selectOpened', group: 'view' },
  ];
  assert.deepEqual(groupCompactActions(actions), [
    actions[0],
    null,
    actions[1],
    null,
    actions[2],
    actions[3],
    null,
    actions[4],
    actions[5],
    null,
    actions[6],
    null,
    actions[7],
    actions[8],
  ]);
});

test('Commit Changes actions declare IDEA semantic groups without changing order', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  const toolbar = panel.slice(panel.indexOf("id: 'refresh'"), panel.indexOf("id: 'expandChanges'") + 900);
  const groups = [...toolbar.matchAll(/id: '([^']+)'[\s\S]*?group: '([^']+)'/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(groups, [
    ['refresh', 'refresh'],
    ['rollback', 'local'],
    ['showDiff', 'diff'],
    ['shelve', 'shelve'],
    ['combinedDiff', 'diff'],
    ['copyPatch', 'patch'],
    ['createPatch', 'patch'],
    ['stageAllTracked', 'local'],
    ['viewOptions', 'view'],
    ['selectOpened', 'view'],
    ['expandChanges', 'view'],
    ['collapseChanges', 'view'],
  ]);
});

test('the compact overflow menu renders grouped actions and keeps null separators', () => {
  const bar = compactActionBarSource;
  assert.match(bar, /items: groupCompactActions\(hidden\)\.map/);
  assert.match(bar, /action === null\s*\? null/);
  assert.match(bar, /disabled: action\.disabled === true/);
});
