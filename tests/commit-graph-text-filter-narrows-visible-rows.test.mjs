import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('Graph mode applies the shared text filter before deriving visible rows', () => {
  assert.match(source, /commitLogFilterCommits\(graphEntries, filter\)/u);
  assert.match(
    source,
    /const filteredGraphEntries = React\.useMemo\(\s*\(\) => \(graphMode \? commitLogFilterCommits\(graphEntries, filter\) : graphEntries\),/u,
  );
  assert.match(
    source,
    /const graphRows = React\.useMemo\(\s*\(\) => \(graphMode \? graphDisplayEntries\(filteredGraphEntries, graphFolded\) : graphEntries\),/u,
  );
  assert.match(source, /visibleEntries=\{filteredGraphEntries\}/u);
});

test('filtering the Graph revalidates the keyboard cursor against visible rows', () => {
  assert.match(source, /\}, \[filter, graphCursor, graphFolded, graph\?\.entries\]\);/u);
});

test('Graph filtering reports no matches instead of a false empty-branch state', async () => {
  const graph = await readFile(new URL('../src/client/components/commit/CommitGraph.tsx', import.meta.url), 'utf8');
  const listState = await readFile(
    new URL('../src/client/components/commit/CommitLogListState.tsx', import.meta.url),
    'utf8',
  );

  assert.match(graph, /visibleEntries\?: CommitGraphEntryData\[\];/u);
  assert.match(graph, /const entries = visibleEntries \?\? sourceEntries;/u);
  assert.doesNotMatch(listState, /section === 'status' && !graphMode && commitCount > 0 && visibleCount === 0/u);
});
