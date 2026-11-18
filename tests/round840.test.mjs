import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorTerminalArea is a reusable TSX terminal area', async () => {
  const component = await read('src/client/components/terminal/EditorTerminalArea.tsx');

  assert.match(component, /export interface EditorTerminalAreaProps/u);
  assert.match(component, /function EditorTerminalArea\(/u);
  assert.match(component, /if \(!active \|\| terminal === null\) return null;/u);
  assert.match(component, /<EditorTerminalTab/u);
  assert.match(component, /fontSize=\{12\}/u);
  assert.match(component, /getCwd=\{\(\) => terminal\.cwd\}/u);
  assert.match(component, /onInput=\{onInput\}/u);
  assert.match(component, /onReturnToDock=\{onReturnToDock\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorTerminalArea and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-terminal-area.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorTerminalArea\.tsx/u);
  assert.match(build, /editorTerminalAreaModule/u);
  assert.doesNotMatch(workspace, /React\.createElement\(EditorTerminalTab, \{/u);
  assert.match(workspace, /<EditorTerminalArea/u);
  assert.match(
    workspace,
    /<EditorTerminalArea[\s\S]*?terminal=\{editorTerminals\[editorTerminals\.length - 1\] \?\? null\}/u,
  );
  assert.match(
    workspace,
    /<EditorTerminalArea[\s\S]*?onReturnToDock=\{\(terminal\) => returnEditorTerminalToDock\(terminal\)\}/u,
  );
  assert.match(fixture, /EDITOR_TERMINAL_AREA_END/u);
  assert.match(client, /function EditorTerminalArea\(/u);
  assert.match(client, /React\.createElement\(EditorTerminalArea, \{/u);
});
