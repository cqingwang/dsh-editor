import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorSplitPane is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorSplitPane.tsx');

  assert.match(component, /export interface EditorSplitPaneProps/u);
  assert.match(component, /function EditorSplitPane\(/u);
  assert.match(component, /data-dsh-editor-split=''/u);
  assert.match(component, /<EditorSplitHeader/u);
  assert.match(component, /ref=\{containerRef\}/u);
  assert.match(component, /display: editorHidden \? 'none' : undefined/u);
  assert.match(component, /\{imagePreview\}/u);
  assert.match(component, /export \{ EditorSplitPane \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
