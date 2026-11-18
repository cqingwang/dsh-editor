import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('commit helpers live in a reusable TypeScript model', async () => {
  const model = await read('src/client/components/ui/commit-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  for (const name of ['selectionStateOf', 'subtotalOf', 'commitMetrics']) {
    assert.match(model, new RegExp(`export function ${name}\\(`, 'u'));
    assert.match(barrel, new RegExp(`${name},`, 'u'));
  }
});

test('ui-primitives is retired as a build reference only', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('tests/fixtures/legacy/ui-primitives.legacy.js');

  assert.match(
    build,
    /'selectionStateOf',\s+'subtotalOf',\s+'commitMetrics',/u,
  );
  assert.doesNotMatch(build, /'ui-primitives\.js',/u);
  assert.doesNotMatch(legacy, /function selectionStateOf\(/u);
  assert.doesNotMatch(legacy, /function subtotalOf\(/u);
  assert.doesNotMatch(legacy, /function commitMetrics\(/u);
});
