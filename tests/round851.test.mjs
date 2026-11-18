import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorToolWindowResizer is a reusable TSX resize handle', async () => {
  const component = await read('src/client/components/editor/EditorToolWindowResizer.tsx');

  assert.match(component, /export interface EditorToolWindowResizerProps/u);
  assert.match(component, /function EditorToolWindowResizer\(/u);
  assert.match(component, /style=\{styles\.sideResize\}/u);
  assert.match(component, /onMouseDown=\{onMouseDown\}/u);
  assert.match(component, /Math\.max\(14, Math\.min\(72, startWidth \+ delta\)\)/u);
  assert.match(component, /onWidthChange\(latest\)/u);
  assert.match(component, /onCommit\(latest\)/u);
  assert.match(component, /export \{ EditorToolWindowResizer \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorToolWindowResizer and workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-tool-window-resizer.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorToolWindowResizer\.tsx/u);
  assert.match(build, /editorToolWindowResizerModule/u);
  assert.doesNotMatch(workspace, /style: styles\.sideResize/u);
  assert.match(workspace, /<EditorToolWindowResizer/u);
  assert.match(workspace, /<EditorToolWindowResizer[\s\S]*?onWidthChange=\{\(value\) => setToolWidths/u);
  assert.match(workspace, /<EditorToolWindowResizer[\s\S]*?onDraggingChange=\{setSideDragging\}/u);
  assert.match(
    workspace,
    /<EditorToolWindowResizer[\s\S]*?onCommit=\{\(final\) => writeToolWidth\(rootRef\.current, activity, final\)\}/u,
  );
  assert.match(fixture, /EDITOR_TOOL_WINDOW_RESIZER_END/u);
  assert.match(client, /function EditorToolWindowResizer\(/u);
});
