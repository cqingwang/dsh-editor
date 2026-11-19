import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('a hidden Commit Log pauses local file availability polling', () => {
  assert.match(
    source,
    /React\.useEffect\(\(\) => \{\s+if \(hidden\) return undefined;\s+if \(detail === null[\s\S]*?callFs\(\{[\s\S]*?startVisibilityGatedPoll\(checkLocalFiles, 3000\)/u,
  );
});

test('visibility changes restart the file check when the log returns', () => {
  assert.match(source, /startVisibilityGatedPoll\(checkLocalFiles, 3000\)/u);
  assert.match(source, /\}, \[hidden, detail\?\.hash, detailPathKey\]\);/u);
});
