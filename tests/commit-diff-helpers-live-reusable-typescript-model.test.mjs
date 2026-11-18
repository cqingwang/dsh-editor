import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('diff helpers live in a reusable TypeScript model', async () => {
  const model = await read('src/client/components/ui/diff-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  assert.match(model, /export function diffSideLabels\(/u);
  assert.match(model, /export function diffViewStateKey\(/u);
  assert.match(model, /export function transferDiffLine\(/u);
  assert.match(barrel, /diffSideLabels,/u);
  assert.match(barrel, /diffViewStateKey,/u);
  assert.match(barrel, /transferDiffLine,/u);
});
