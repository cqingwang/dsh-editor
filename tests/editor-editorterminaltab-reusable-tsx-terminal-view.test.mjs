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
