import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('RevisionPicker and commit search are reusable TS/TSX modules', async () => {
  const picker = await read('src/client/components/commit/RevisionPicker.tsx');
  const model = await read('src/client/components/commit/commit-search-model.ts');

  assert.match(picker, /export interface RevisionPickerProps/u);
  assert.match(picker, /role='dialog'/u);
  assert.match(picker, /event\.key === 'ArrowDown'/u);
  assert.match(picker, /event\.key === 'ArrowUp'/u);
  assert.match(picker, /event\.key === 'Enter'/u);
  assert.match(picker, /event\.key === 'Escape'/u);
  assert.match(model, /export function commitSearchScore\(/u);
  assert.doesNotMatch(picker, /React\.createElement/u);
});

test('build embeds RevisionPicker and commit.js has no duplicate implementation', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/commit.ts');
  const fixture = await read('tests/fixtures/commit-panel.legacy.js');

  assert.match(build, /RevisionPicker\.tsx/u);
  assert.match(build, /commit-search-model\.ts/u);
  assert.match(build, /revisionPickerModule/u);
  assert.doesNotMatch(legacy, /function RevisionPicker\(/u);
  assert.doesNotMatch(legacy, /function commitSearchScore\(/u);
  assert.match(fixture, /function RevisionPicker\(/u);
});
