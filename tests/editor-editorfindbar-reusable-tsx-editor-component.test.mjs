import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorFindBar is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorFindBar.tsx');

  assert.match(component, /export interface EditorFindBarProps/u);
  assert.match(component, /function EditorFindBar\(/u);
  assert.match(component, /data-dsh-editor-find-input=''/u);
  assert.match(component, /data-dsh-editor-find-replace-input=''/u);
  assert.match(component, /data-dsh-editor-find-history-menu=''/u);
  assert.match(component, /icon='preserveCase'/u);
  assert.match(component, /event\.altKey === true && event\.key === 'ArrowDown'/u);
  assert.match(component, /export \{ EditorFindBar \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
