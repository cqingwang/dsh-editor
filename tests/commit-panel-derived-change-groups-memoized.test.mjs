import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');
const view = panel.slice(panel.indexOf('function CommitPanel('), panel.indexOf('function groupActionMenuItems('));

test('CommitPanel memoizes change derivations independently from message typing', () => {
  assert.match(
    view,
    /const changes = React\.useMemo\(\(\) => \(Array\.isArray\(git\?\.changes\) \? git\.changes : \[\]\), \[git\?\.changes\]\)/u,
  );
  assert.match(view, /const changesByPath = React\.useMemo\(\(\) => new Map/u);
  assert.match(
    view,
    /const stageAllTrackedPaths = React\.useMemo\(\(\) => stageAllTargets\(changes, true\), \[changes\]\)/u,
  );
  assert.match(view, /const changeSplit = React\.useMemo\(\(\) => splitChanges\(changes\), \[changes\]\)/u);
  assert.match(view, /const groups = React\.useMemo\(/u);
  assert.match(view, /const visibleGroups = React\.useMemo\(/u);
  assert.match(
    view,
    /const filteredTargets = React\.useMemo\(\(\) => changeFilterTargets\(visibleGroups\), \[visibleGroups\]\)/u,
  );
  assert.match(view, /const allSelected = React\.useMemo\(/u);
});

test('commit message and other local state are absent from change-group dependencies', () => {
  const groupsBlock = view.slice(
    view.indexOf('const groups = React.useMemo('),
    view.indexOf('const visibleGroups = React.useMemo('),
  );
  const visibleBlock = view.slice(
    view.indexOf('const visibleGroups = React.useMemo('),
    view.indexOf('const filteredTargets = React.useMemo('),
  );
  assert.doesNotMatch(groupsBlock, /message|amend|busy|notice|error/u);
  assert.doesNotMatch(visibleBlock, /message|amend|busy|notice|error/u);
});
