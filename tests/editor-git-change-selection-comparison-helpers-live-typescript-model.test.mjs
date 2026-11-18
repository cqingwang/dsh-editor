import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('git change selection and comparison helpers live in a TypeScript model', async () => {
  const model = await read('src/client/components/ui/git-change-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  for (const name of ['canCompareWithHead', 'badgeFor', 'allPathsUnversioned', 'pathsScheduledForRemoval']) {
    assert.match(model, new RegExp(`export function ${name}\\(`, 'u'));
    assert.match(barrel, new RegExp(`${name},`, 'u'));
  }
});
