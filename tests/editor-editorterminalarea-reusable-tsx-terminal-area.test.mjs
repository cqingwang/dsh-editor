import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorTerminalArea is a reusable TSX terminal area', async () => {
  const component = await read('src/client/components/terminal/EditorTerminalArea.tsx');

  assert.match(component, /export interface EditorTerminalAreaProps/u);
  assert.match(component, /function EditorTerminalArea\(/u);
  assert.match(component, /if \(!active \|\| terminals\.length === 0\) return null;/u);
  assert.match(component, /<EditorTerminalTab/u);
  assert.match(component, /terminals=\{resolvedTerminals\}/u);
  assert.match(component, /onSelectTerminal=\{selectTerminal\}/u);
  assert.match(component, /fontSize=\{EDITOR_FONT_SIZE_SCALE\.body\}/u);
  assert.match(component, /getCwd=\{\(\) => terminal\.cwd\}/u);
  assert.match(component, /onInput=\{onInput\}/u);
  assert.match(component, /onReturnToDock=\{onReturnToDock\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
