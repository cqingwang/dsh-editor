import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorGotoLinePopup is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorGotoLinePopup.tsx');

  assert.match(component, /export interface EditorGotoLinePopupProps/u);
  assert.match(component, /function EditorGotoLinePopup\(/u);
  assert.match(component, /role='dialog'/u);
  assert.match(component, /data-dsh-editor-goto-dialog=''/u);
  assert.match(component, /data-dsh-editor-goto-input=''/u);
  assert.match(component, /aria-invalid=\{state\.error !== null\}/u);
  assert.match(component, /event\.key === 'Enter'[\s\S]*?onSubmit\(\)/u);
  assert.match(component, /event\.key === 'Escape'[\s\S]*?onClose\(\)/u);
  assert.match(component, /export \{ EditorGotoLinePopup \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
