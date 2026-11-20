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

const actions = [
  { id: 'refresh', pinned: true },
  { id: 'rollback' },
  { id: 'showDiff' },
  { id: 'shelve' },
  { id: 'combinedDiff' },
  { id: 'copyPatch' },
  { id: 'createPatch' },
  { id: 'stageAllTracked' },
  { id: 'viewOptions', pinned: true },
  { id: 'selectOpened' },
  { id: 'expandChanges' },
  { id: 'collapseChanges' },
];

function loadSelector() {
  return new Function(`${extract('selectCompactActions')}\nreturn selectCompactActions;`)();
}

test('200px Changes toolbar keeps Refresh and View Options ahead of secondary actions', () => {
  const selectCompactActions = loadSelector();
  /* CompactActionBar measures 26px slots after its 8px horizontal padding. */
  const slots = Math.floor((200 - 8) / 26);
  const directLimit = Math.max(0, slots - 1);
  const visible = selectCompactActions(actions, directLimit);
  const visibleIds = visible.map((action) => action.id);
  const hiddenIds = actions.filter((action) => visible.includes(action) === false).map((action) => action.id);
  assert.deepEqual(visibleIds, [
    'refresh',
    'rollback',
    'showDiff',
    'shelve',
    'combinedDiff',
    'viewOptions',
  ]);
  assert.deepEqual(hiddenIds, [
    'copyPatch',
    'createPatch',
    'stageAllTracked',
    'selectOpened',
    'expandChanges',
    'collapseChanges',
  ]);
});

test('pinned actions never reorder the full IDEA action sequence', () => {
  const selectCompactActions = loadSelector();
  assert.deepEqual(selectCompactActions(actions, actions.length), actions);
  const originalIds = actions.map((action) => action.id);
  actions[0].disabled = true;
  selectCompactActions(actions, 6);
  assert.deepEqual(actions.map((action) => action.id), originalIds);
  assert.equal(actions[0].disabled, true);
});

test('the compact action bar renders the selected set and overflows every other action', () => {
  const bar = compactActionBarSource;
  assert.match(bar, /const visibleActions = selectCompactActions\(actions, visibleCount\);/);
  assert.match(bar, /const hidden = actions\.filter\(\(action\) => visibleActions\.includes\(action\) === false\);/);
  assert.match(bar, /visibleActions\.map\(\(action\) =>/);
});

test('Refresh and View Options are pinned Changes toolbar actions', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  assert.match(
    panel,
    /id: 'refresh',\s+group: 'refresh',\s+icon: 'refresh',\s+label: t\('editor\.refresh'\),\s+pinned: true,/u,
  );
  assert.match(panel, /id: 'viewOptions',[\s\S]*?label: t\('editor\.viewOptions'\),[\s\S]*?pinned: true/u);
});
