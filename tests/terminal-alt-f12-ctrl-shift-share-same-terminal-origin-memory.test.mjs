import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

function keyboardHandler() {
  const start = source.indexOf('Alt+F12, Alt+1..3 and Ctrl+Shift+`');
  return source.slice(
    start,
    source.indexOf("}, [selectActivity, terminalOpen]);", start),
  );
}

test('Alt+F12 and Ctrl+Shift+` share the same terminal-origin memory', () => {
  const handler = keyboardHandler();
  assert.match(handler, /const rememberTerminalOrigin = \(\) => \{/);
  assert.match(handler, /current\.closest\('\[data-dsh-editor-terminal\]'\) === null/);
  assert.match(handler, /terminalReturnFocusRef\.current =\s+current !== null/);
  assert.match(handler, /const toggleTerminalDock = \(\) => \{[\s\S]*?rememberTerminalOrigin\(\);/);
});

test('both terminal shortcuts raise the existing dock and return focus through one path', () => {
  const handler = keyboardHandler();
  const shortcut = handler.slice(handler.indexOf("event.ctrlKey && event.shiftKey"));
  assert.match(shortcut, /toggleTerminalDock\(\);/);
  const toggle = handler.slice(handler.indexOf('const toggleTerminalDock = () => {'), handler.indexOf('const onKeyDown = (event) => {'));
  assert.match(toggle, /rememberTerminalOrigin\(\);[\s\S]*?setTerminalOpen\(true\)/);
  assert.match(toggle, /setTerminalFocusGeneration/);
  assert.match(toggle, /restoreTerminalOrigin\(\)/);
});

test('opening the terminal does not overwrite origin with the terminal itself', () => {
  const handler = keyboardHandler();
  assert.match(handler, /current !== null && current\.closest\('\[data-dsh-editor-terminal\]'\) === null[\s\S]*?: editorNode/);
});
