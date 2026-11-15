import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Changes owns a group-node selection separate from commit checkboxes', () => {
  assert.match(source, /const \[selectedGroup, setSelectedGroup\] = React\.useState\(null\);/);
  const parent = source.slice(source.indexOf('const chooseGroup = React.useCallback('), source.indexOf('/**\n       * Visible Changes rows selected'));
  assert.match(parent, /setSelectedGroup\(group\)/);
  assert.match(parent, /setSelectedChange\(null\)/);
  assert.doesNotMatch(parent, /setCommitSelection/);
  assert.match(source, /onSelectGroup: chooseGroup/);
});

test('the group header is the selectable tree row and controls do not re-select it', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  assert.match(panel, /'data-dsh-change-group': group\.id/);
  assert.match(panel, /role: 'treeitem'/);
  assert.match(panel, /'aria-selected': selectedGroup === group\.id/);
  assert.match(panel, /onClick: \(event\) => \{\s+if \(event\.target instanceof Element && event\.target\.closest\('input, button, \[role="button"\]'\) !== null\) return;/);
  assert.match(panel, /onSelectGroup\?\.\(group\.id\)/);
});

test('file-only shortcuts stand aside while a group node is selected', () => {
  for (const callback of ['rollbackWorkingShortcut', 'stageShortcut', 'showDiffShortcut']) {
    const start = source.indexOf(`const ${callback} = React.useCallback(`);
    assert.notEqual(start, -1);
    const block = source.slice(start, source.indexOf('}, [', start));
    assert.match(block, /selectedGroupRef\.current !== null/);
  }
});

test('Changes keyboard navigation moves through group and file rows', () => {
  const start = source.indexOf('const onChangesKeyDown = React.useCallback(');
  const block = source.slice(start, source.indexOf('const onChangesKeyUp = React.useCallback(', start));
  assert.match(block, /\[data-dsh-change-group\], \[data-dsh-change-path\], \[data-dsh-change-directory\]/);
  assert.match(block, /row\.getAttribute\('data-dsh-change-group'\)/);
  assert.match(block, /chooseGroup\(group\)/);
});
