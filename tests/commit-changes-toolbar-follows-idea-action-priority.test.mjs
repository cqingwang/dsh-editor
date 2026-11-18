import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/commit-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commitPanel = source.slice(
  source.indexOf('function CommitPanel('),
  source.indexOf('function groupActionMenuItems('),
);
const actionsStart = commitPanel.indexOf('actions: [', commitPanel.indexOf('CompactActionBar'));
const actionsEnd = commitPanel.indexOf('],\n            }),', actionsStart);
const actionsBlock = commitPanel.slice(actionsStart, actionsEnd);
const ids = [...actionsBlock.matchAll(
  /id: '(showDiff|combinedDiff|copyPatch|createPatch|refresh|stageAllTracked|viewOptions|selectOpened|expandChanges|collapseChanges|rollback)'/g,
)].map((match) => match[1]);

test('Changes toolbar follows IDEA action priority', () => {
  assert.deepEqual(ids, [
    'refresh',
    'rollback',
    'showDiff',
    'combinedDiff',
    'copyPatch',
    'createPatch',
    'stageAllTracked',
    'viewOptions',
    'selectOpened',
    'expandChanges',
    'collapseChanges',
  ]);
});

test('Rollback groups with local change operations instead of trailing history', () => {
  const rollback = commitPanel.slice(commitPanel.indexOf("id: 'rollback'"), commitPanel.indexOf("id: 'showDiff'", commitPanel.indexOf("id: 'rollback'")));
  assert.match(rollback, /group: 'local'/);
  assert.match(rollback, /icon: 'undo'/);
  assert.match(rollback, /onRollbackSelected\?\.\(chosenChangeList\)/);
});
