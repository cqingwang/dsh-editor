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
