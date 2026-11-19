import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');

test('Commit caches group selection scans outside renderGroup', () => {
  assert.match(panel, /const groupSelectionViews = React\.useMemo\(\(\) => \{/u);
  assert.match(
    panel,
    /group\.changes\s+\.filter\(\(change\) => selectedPaths\.has\(change\.path\)\)\s+\.map\(\(change\) => change\.path\);/u,
  );
  assert.match(panel, /selectionStateOf\(\s*group\.changes\.map\(\(change\) => change\.path\),\s*selectedPaths,\s*\)/u);
  assert.match(panel, /pathsScheduledForRemoval\(/u);

  const memoAt = panel.indexOf('const groupSelectionViews = React.useMemo(');
  const renderAt = panel.indexOf('const renderGroup =');
  assert.ok(memoAt > 0);
  assert.ok(renderAt > memoAt);

  const groupActionsAt = panel.indexOf('const groupActions =', renderAt);
  assert.ok(groupActionsAt > renderAt);
  const groupHeader = panel.slice(renderAt, groupActionsAt);
  assert.doesNotMatch(groupHeader, /group\.changes\.filter\(\(change\) => selectedPaths\.has/u);
  assert.doesNotMatch(groupHeader, /selectionStateOf\(/u);
  assert.doesNotMatch(groupHeader, /pathsScheduledForRemoval\(/u);
  assert.match(groupHeader, /const groupSelection = groupSelectionViews\.get\(group\.id\);/u);
  assert.match(
    groupHeader,
    /const \{ selectedInGroup, groupState, removableInGroup, removalOnlyInGroup \} = groupSelection;/u,
  );
});

test('group selection cache follows only its real inputs', () => {
  assert.match(panel, /\}, \[changesByPath, selectedPaths, visibleGroups\]\);/u);
});
