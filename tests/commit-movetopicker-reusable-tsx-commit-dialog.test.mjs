import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('MoveToPicker is a reusable TSX commit dialog', async () => {
  const picker = await read('src/client/components/commit/MoveToPicker.tsx');

  assert.match(picker, /export interface MoveToPickerProps/u);
  assert.match(picker, /role='dialog'/u);
  assert.match(picker, /event\.key === 'ArrowDown'/u);
  assert.match(picker, /event\.key === 'ArrowUp'/u);
  assert.match(picker, /event\.key === 'Enter'/u);
  assert.match(picker, /event\.key === 'Escape'/u);
  assert.match(picker, /t\('editor\.moveToCurrent'\)/u);
  assert.doesNotMatch(picker, /React\.createElement/u);
});

test('build embeds MoveToPicker and legacy commit.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/commit.ts');
  const fixture = await read('tests/fixtures/commit-panel.legacy.js');

  assert.match(build, /MoveToPicker\.tsx/u);
  assert.match(build, /moveToPickerModule/u);
  assert.doesNotMatch(legacy, /function MoveToPicker\(/u);
  assert.match(fixture, /function MoveToPicker\(/u);
});
