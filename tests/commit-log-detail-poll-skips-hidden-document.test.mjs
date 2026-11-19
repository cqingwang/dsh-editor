import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('hidden browser tabs stop Commit detail file polling', () => {
  assert.match(source, /const checkLocalFiles = \(\) =>/u);
  assert.match(source, /startVisibilityGatedPoll\(checkLocalFiles, 3000\)/u);
  assert.doesNotMatch(source, /document\.addEventListener\('visibilitychange', onVisibilityChange\);/u);
  assert.doesNotMatch(source, /window\.setInterval\(/u);
});
