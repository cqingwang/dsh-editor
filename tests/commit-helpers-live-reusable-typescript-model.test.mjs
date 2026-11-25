import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('commit helpers live in a reusable TypeScript model', async () => {
  const model = await read('src/client/components/ui/commit-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');
  const build = await read('scripts/build-client.mjs');

  for (const name of [
    'selectionStateOf',
    'subtotalOf',
    'commitMetrics',
    'changeSelectionKey',
    'reconcileChangeSelectionModel',
  ]) {
    assert.match(model, new RegExp(`export function ${name}\\(`, 'u'));
    assert.match(barrel, new RegExp(`${name},`, 'u'));
    assert.match(build, new RegExp(`'${name}',`, 'u'));
  }
});
