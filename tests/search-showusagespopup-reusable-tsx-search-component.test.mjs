import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('ShowUsagesPopup is a reusable TSX search component', async () => {
  const popup = await read('src/client/components/search/ShowUsagesPopup.tsx');

  assert.match(popup, /export interface ShowUsagesPopupProps/u);
  assert.match(popup, /data-dsh-show-usages=''/u);
  assert.match(popup, /role='dialog'/u);
  assert.match(popup, /role='listbox'/u);
  assert.match(popup, /<ContextMenu/u);
  assert.match(popup, /<ToolbarButton/u);
  assert.match(popup, /event\.key === 'ContextMenu'/u);
  assert.match(popup, /event\.key === 'ArrowDown'/u);
  assert.match(popup, /event\.key === 'Escape'/u);
  assert.doesNotMatch(popup, /React\.createElement/u);
});
