import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorAnnotateArea is a reusable TSX annotate surface', async () => {
  const component = await read('src/client/components/editor/EditorAnnotateArea.tsx');

  assert.match(component, /export interface EditorAnnotateAreaProps/u);
  assert.match(component, /function EditorAnnotateArea\(/u);
  assert.match(component, /if \(!active \|\| target === null\) return null;/u);
  assert.match(component, /<AnnotatePreview/u);
  assert.match(component, /loading=\{loading\}/u);
  assert.match(component, /truncated=\{truncated\}/u);
  assert.match(component, /onOpenCommit=\{onOpenCommit\}/u);
  assert.match(component, /selected=\{selected\}/u);
  assert.match(component, /export \{ EditorAnnotateArea \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
