import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('Commit Log memoizes the active flat filter', () => {
  assert.match(
    log,
    /const visible = React\.useMemo\(\s*\(\) => \(searchMode \? displayedCommits : commitLogFilterCommits\(displayedCommits, filter\)\),\s*\[displayedCommits, filter, searchMode\],\s*\);/u,
  );
  assert.doesNotMatch(log, /const visible = commitLogFilterCommits\(displayedCommits, filter\);/u);
});

test('Commit Log filters and folds Graph entries only while Graph mode is active', () => {
  assert.match(
    log,
    /const filteredGraphEntries = React\.useMemo\(\s*\(\) => \(graphMode \? commitLogFilterCommits\(graphEntries, filter\) : graphEntries\),\s*\[filter, graphEntries, graphMode\],\s*\);/u,
  );
  assert.match(
    log,
    /const graphRows = React\.useMemo\(\s*\(\) => \(graphMode \? graphDisplayEntries\(filteredGraphEntries, graphFolded\) : graphEntries\),\s*\[filteredGraphEntries, graphEntries, graphFolded, graphMode\],\s*\);/u,
  );
});
