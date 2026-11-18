import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorMainPane is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorMainPane.tsx');

  assert.match(component, /export interface EditorMainPaneProps/u);
  assert.match(component, /function EditorMainPane\(/u);
  assert.match(component, /data-dsh-markdown-workspace=''/u);
  assert.match(component, /ref=\{containerRef\}/u);
  assert.match(component, /data-dsh-markdown-editor-pane=''/u);
  assert.match(component, /display: editorHidden \? 'none' : undefined/u);
  assert.match(component, /splitOpen \? `0 0 clamp\(96px, \$\{splitPercent\}%, calc\(100% - 103px\)\)` : '1 1 0'/u);
  assert.match(component, /\{preview\}/u);
  assert.match(component, /export \{ EditorMainPane \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorMainPane and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-main-pane.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorMainPane\.tsx/u);
  assert.match(build, /editorMainPaneModule/u);
  assert.doesNotMatch(workspace, /'data-dsh-markdown-workspace': ''/u);
  assert.match(workspace, /<EditorMainPane/u);
  assert.match(workspace, /<EditorMainPane[\s\S]*?focused=\{leftFocused\}/u);
  assert.match(workspace, /<EditorMainPane[\s\S]*?preview=\{\s*activeImage/u);
  assert.match(fixture, /EDITOR_MAIN_PANE_END/u);
  assert.match(client, /function EditorMainPane\(/u);
  assert.match(client, /React\.createElement\(EditorMainPane, \{/u);
});
