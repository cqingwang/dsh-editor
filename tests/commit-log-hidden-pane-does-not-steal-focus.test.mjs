import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('a hidden Commit Log never focuses its list after a background recovery', () => {
  assert.match(source, /const recovered = logFailedRef\.current && !failed;[\s\S]*?if \(recovered && !hidden\)/u);
  assert.match(source, /\}, \[hidden, logFailure\]\);/u);
});
