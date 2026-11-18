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

test('build embeds EditorToolWindowPanel and workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-tool-window-panel.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorToolWindowPanel\.tsx/u);
  assert.match(build, /editorToolWindowPanelModule/u);
  assert.match(workspace, /<EditorToolWindowPanel/u);
  assert.match(workspace, /<EditorToolWindowPanel[\s\S]*?activity=\{activity\}/u);
  assert.match(workspace, /<EditorToolWindowPanel[\s\S]*?widthPercent=\{toolWidths\[activity\]/u);
  assert.match(workspace, /<EditorToolWindowPanel[\s\S]*?dragging=\{sideDragging\}/u);
  assert.match(workspace, /<EditorToolWindowPanel[\s\S]*?toolPanelFlex/u);
  assert.match(fixture, /EDITOR_TOOL_WINDOW_PANEL_END/u);
  assert.match(client, /function EditorToolWindowPanel\(/u);
});
