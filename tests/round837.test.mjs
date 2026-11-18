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

test('build embeds EditorSplitPane and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-split-pane.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorSplitPane\.tsx/u);
  assert.match(build, /editorSplitPaneModule/u);
  assert.doesNotMatch(workspace, /'data-dsh-editor-split': ''/u);
  assert.match(workspace, /<EditorSplitPane/u);
  assert.match(workspace, /<EditorSplitPane[\s\S]*?containerRef=\{splitContainerRef\}/u);
  assert.match(workspace, /<EditorSplitPane[\s\S]*?imagePreview=\{\s*splitImage && splitPath !== null/u);
  assert.match(fixture, /data-dsh-editor-split-divider/u);
  assert.match(fixture, /EDITOR_SPLIT_PANE_END/u);
  assert.match(client, /function EditorSplitPane\(/u);
  assert.match(client, /React\.createElement\(EditorSplitPane, \{/u);
});
