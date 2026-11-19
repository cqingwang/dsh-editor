import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8');

test('hidden browser tabs stop Diff local-path polling', () => {
  assert.match(source, /const checkLocalPath = \(\) =>/u);
  assert.match(source, /startVisibilityGatedPoll\(checkLocalPath, delay\)/u);
  assert.doesNotMatch(source, /document\.addEventListener\('visibilitychange', onVisibilityChange\);/u);
  assert.doesNotMatch(source, /window\.setInterval\(/u);
});
