import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('PathLabel and LineCounts are reusable TSX UI components', async () => {
  const pathLabel = await read('src/client/components/ui/PathLabel.tsx');
  const lineCounts = await read('src/client/components/ui/LineCounts.tsx');
  const barrel = await read('src/client/components/ui/index.tsx');

  assert.match(pathLabel, /export function PathLabel\(/u);
  assert.match(pathLabel, /<span/u);
  assert.doesNotMatch(pathLabel, /React\.createElement/u);
  assert.match(lineCounts, /export function LineCounts\(/u);
  assert.match(lineCounts, /<span/u);
  assert.doesNotMatch(lineCounts, /React\.createElement/u);
  assert.match(barrel, /export \{ PathLabel, splitPathLabel/u);
  assert.match(barrel, /export \{ LineCounts/u);
});
