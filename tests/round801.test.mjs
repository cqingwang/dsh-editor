import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorTerminalTab is a reusable TSX terminal view', async () => {
  const tab = await read('src/client/components/terminal/EditorTerminalTab.tsx');

  assert.match(tab, /export interface EditorTerminalTabProps/u);
  assert.match(tab, /data-dsh-editor-terminal-tab=\{terminal\.id\}/u);
  assert.match(tab, /terminalReturnToDock/u);
  assert.match(tab, /<TerminalScreen/u);
  assert.match(tab, /onInput=\{\(data\) => onInput\(terminal\.id, data\)\}/u);
  assert.doesNotMatch(tab, /React\.createElement/u);
});

test('build embeds EditorTerminalTab and terminal.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/terminal.ts');
  const fixture = await read('tests/fixtures/terminal-screen.legacy.js');

  assert.match(build, /EditorTerminalTab\.tsx/u);
  assert.match(build, /editorTerminalTabModule/u);
  assert.doesNotMatch(legacy, /function EditorTerminalTab\(/u);
  assert.match(fixture, /function EditorTerminalTab\(/u);
});
