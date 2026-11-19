import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('Commit Log memoizes the active flat filter', () => {
  assert.match(
    log,
    /const visible = React\.useMemo\(\(\) => commitLogFilterCommits\(commits, filter\), \[commits, filter\]\);/u,
  );
  assert.doesNotMatch(log, /const visible = commitLogFilterCommits\(commits, filter\);/u);
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
