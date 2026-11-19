import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('Commit Log caches flat and graph hash order from visible rows', () => {
  assert.match(
    log,
    /const visibleOrder = React\.useMemo\(\(\) => visible\.map\(\(entry\) => entry\.hash\), \[visible\]\);/u,
  );
  assert.match(
    log,
    /const graphOrder = React\.useMemo\(\(\) => graphRows\.map\(\(entry\) => entry\.hash\), \[graphRows\]\);/u,
  );
  assert.match(log, /commitSelectionAfterClick\(\s+graphOrder,/u);
  assert.match(log, /commitSelectionAfterClick\(\s+visibleOrder,/u);
  assert.equal(log.match(/graphRows\.map\(\(entry\) => entry\.hash\)/gu)?.length, 1);
  assert.equal(log.match(/visible\.map\(\(entry\) => entry\.hash\)/gu)?.length, 1);
});
