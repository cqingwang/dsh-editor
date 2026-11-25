import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const logSource = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('Commit Log focuses its listbox when the panel becomes visible', () => {
  assert.match(
    logSource,
    /React\.useEffect\(\(\) => \{\s+if \(hidden\) return;\s+window\.setTimeout\(\(\) => listRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\), 0\);\s+\}, \[hidden\]\);/u,
  );
});
