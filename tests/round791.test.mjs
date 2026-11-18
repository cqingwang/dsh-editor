import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('GitStatusBadge and gitStatusInfo are reusable TS/TSX UI modules', async () => {
  const badge = await read('src/client/components/ui/GitStatusBadge.tsx');
  const model = await read('src/client/components/ui/git-status-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  assert.match(badge, /export function GitStatusBadge\(/u);
  assert.match(badge, /<span/u);
  assert.doesNotMatch(badge, /React\.createElement/u);
  assert.match(model, /export function gitStatusInfo\(/u);
  assert.match(barrel, /export \{ GitStatusBadge/u);
  assert.match(barrel, /export \{ gitStatusInfo/u);
});

test('the build exports the git status module and removes its legacy implementation', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('tests/fixtures/legacy/ui-primitives.legacy.js');

  assert.match(build, /'GitStatusBadge',\s+'gitStatusInfo',/u);
  assert.doesNotMatch(legacy, /function GitStatusBadge\(/u);
  assert.doesNotMatch(legacy, /function gitStatusInfo\(/u);
});
