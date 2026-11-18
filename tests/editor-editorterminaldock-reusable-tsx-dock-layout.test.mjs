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
