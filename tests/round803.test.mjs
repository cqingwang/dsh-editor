import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('SearchEverywhere is a reusable TSX search feature component', async () => {
  const dialog = await read('src/client/components/search/SearchEverywhere.tsx');

  assert.match(dialog, /export interface SearchEverywhereProps/u);
  assert.match(dialog, /role='dialog'/u);
  assert.match(dialog, /<CodePreviewCode/u);
  assert.match(dialog, /<CompactActionBar/u);
  assert.match(dialog, /<ContextMenu/u);
  assert.match(dialog, /handleSearchEverywhereDialogKeyDown/u);
  assert.doesNotMatch(dialog, /React\.createElement/u);
});

test('build embeds SearchEverywhere and legacy module has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('tests/fixtures/legacy/search-everywhere.legacy.js');
  const fixture = await read('tests/fixtures/search-everywhere.legacy.js');

  assert.match(build, /SearchEverywhere\.tsx/u);
  assert.match(build, /searchEverywhereModule/u);
  assert.doesNotMatch(build, /['"]search-everywhere\.js['"]/u);
  assert.doesNotMatch(legacy, /function SearchEverywhere\(/u);
  assert.match(fixture, /function SearchEverywhere\(/u);
});
