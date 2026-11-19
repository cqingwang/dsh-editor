import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const graph = await readFile(new URL('../src/client/components/commit/CommitGraph.tsx', import.meta.url), 'utf8');

test('Commit Graph caches layout from entries and selection membership from hashes', () => {
  assert.match(
    graph,
    /const sourceEntries = React\.useMemo\(\(\) => \(Array\.isArray\(graph\?\.entries\) \? graph\.entries : \[\]\), \[graph\?\.entries\]\);/u,
  );
  assert.match(graph, /const lanes = React\.useMemo\(\(\) => assignGraphLanes\(entries\), \[entries\]\);/u);
  assert.match(graph, /const runs = React\.useMemo\(\(\) => linearRun\(entries, laneOf\), \[entries, laneOf\]\);/u);
  assert.match(graph, /const rowsToDraw = React\.useMemo\(/u);
  assert.match(
    graph,
    /const selectedHashes = React\.useMemo\(\(\) => new Set\(selectionHashes\), \[selectionHashes\]\);/u,
  );
  assert.match(graph, /selectedHashes\.has\(entry\.hash\)/u);
  assert.doesNotMatch(graph, /selectionHashes\.includes\(entry\.hash\)/u);
});
