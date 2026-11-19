import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');

test('Commit caches group trees and flattened rows outside renderGroup', () => {
  assert.match(panel, /const groupTrees = React\.useMemo\(\(\) => \{/u);
  assert.match(panel, /changeTreeOf\(group\.changes, groupingDepth\(groupBy\)\)/u);
  assert.match(panel, /const groupRows = React\.useMemo\(\(\) => \{/u);
  assert.match(panel, /flattenChangeTree\(tree, collapsedGroups, group\.id\)/u);

  const groupTreesAt = panel.indexOf('const groupTrees = React.useMemo(');
  const groupRowsAt = panel.indexOf('const groupRows = React.useMemo(');
  const renderGroupAt = panel.indexOf('const renderGroup =');
  assert.ok(groupTreesAt > 0);
  assert.ok(groupRowsAt > groupTreesAt);
  assert.ok(renderGroupAt > groupRowsAt);

  const renderGroup = panel.slice(renderGroupAt);
  assert.doesNotMatch(renderGroup, /changeTreeOf\(group\.changes/u);
  assert.doesNotMatch(renderGroup, /flattenChangeTree\(tree/u);
  assert.match(renderGroup, /const tree = groupTrees\.get\(group\.id\);/u);
  assert.match(renderGroup, /const groupView = groupRows\.get\(group\.id\);/u);
});

test('group tree caches follow only their real grouping and folding inputs', () => {
  assert.match(panel, /\}, \[groupBy, visibleGroups\]\);/u);
  assert.match(panel, /\}, \[collapsedGroups, groupTrees, visibleGroups\]\);/u);
});
