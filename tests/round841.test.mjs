import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorTerminalDock is a reusable TSX dock layout', async () => {
  const component = await read('src/client/components/terminal/EditorTerminalDock.tsx');

  assert.match(component, /export interface EditorTerminalDockProps/u);
  assert.match(component, /function EditorTerminalDock\(/u);
  assert.match(component, /if \(!open\) return null;/u);
  assert.match(component, /\.\.\.styles\.dock/u);
  assert.match(component, /\.\.\.styles\.dockResize/u);
  assert.match(component, /onDraggingChange\(true\)/u);
  assert.match(component, /onHeightChange\(latest\)/u);
  assert.match(component, /onCommit\(latest\)/u);
  assert.match(component, /window\.addEventListener\('mousemove', onMove\)/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ EditorTerminalDock \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorTerminalDock and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-terminal-dock.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorTerminalDock\.tsx/u);
  assert.match(build, /editorTerminalDockModule/u);
  assert.match(workspace, /<EditorTerminalDock/u);
  assert.match(workspace, /<EditorTerminalDock[\s\S]*?open=\{terminalOpen\}/u);
  assert.match(
    workspace,
    /<EditorTerminalDock[\s\S]*?onCommit=\{\(final\) => writeStoredNumber\('dsh-editor\.terminal\.height', final\)\}/u,
  );
  assert.match(workspace, /<TerminalPanel/u);
  assert.match(fixture, /EDITOR_TERMINAL_DOCK_END/u);
  assert.match(client, /function EditorTerminalDock\(/u);
  assert.match(client, /React\.createElement\(EditorTerminalDock, \{/u);
});
