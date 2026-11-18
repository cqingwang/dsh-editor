import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorToolWindowPanel is a reusable TSX side-panel shell', async () => {
  const component = await read('src/client/components/editor/EditorToolWindowPanel.tsx');

  assert.match(component, /export interface EditorToolWindowPanelProps/u);
  assert.match(component, /function EditorToolWindowPanel\(/u);
  assert.match(component, /\.\.\.styles\.sidePanel/u);
  assert.match(component, /flex: toolPanelFlex\(activity, widthPercent\)/u);
  assert.match(component, /cursor: dragging \? 'col-resize' : undefined/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ EditorToolWindowPanel \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
