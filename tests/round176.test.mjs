import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

test('the terminal screen reclaims focus whenever it becomes visible', () => {
  const screen = slice('function TerminalScreen({', 'function EditorTerminalTab(');
  assert.match(screen, /const \[visible, setVisible\] = React\.useState\(false\);/);
  assert.match(screen, /const setHostNode = React\.useCallback\(\(node\) =>/);
  assert.match(screen, /node\.getBoundingClientRect\(\)/);
  assert.match(screen, /node\.offsetParent !== null/);
  assert.match(screen, /if \(!ready\) return;[\s\S]*?emulatorRef\.current\?\.focus\(\);[\s\S]*?\}, \[ready, visible, focusGeneration\]\);/);
  assert.match(screen, /ref: setHostNode,/);
  assert.match(screen, /focusGeneration = 0/);
});

test('Alt+F12 records the originating surface and restores it on close', () => {
  const toggle = slice('const toggleTerminalDock = () => {', 'const onKeyDown = (event) => {');
  const origin = source.slice(source.lastIndexOf('const rememberTerminalOrigin = () => {'), source.indexOf('const toggleTerminalDock = () => {'));
  assert.match(toggle, /terminalShortcutAction\(/);
  assert.match(toggle, /document\.activeElement instanceof Element/);
  assert.match(toggle, /if \(action\.open === false\) \{/);
  assert.match(toggle, /restoreTerminalOrigin\(\)/);
  assert.match(origin, /const previous = terminalReturnFocusRef\.current;/);
  assert.match(origin, /previous instanceof HTMLElement && previous\.isConnected/);
  assert.match(origin, /previous\.focus\(\)/);
  assert.match(origin, /else editorRef\.current\?\.focus\(\);/);
  assert.match(origin, /terminalReturnFocusRef\.current = current !== null/);
  assert.match(origin, /current\.closest\('\[data-dsh-editor-terminal\]'\) === null/);
  assert.match(toggle, /rememberTerminalOrigin\(\);\n\s+setTerminalOpen\(true\);/);
  assert.match(toggle, /setTerminalFocusGeneration\(\(value\) => value \+ 1\);/);
  assert.match(source, /terminalReturnFocusRef = React\.useRef\(null\);/);
  assert.match(source, /const \[terminalFocusGeneration, setTerminalFocusGeneration\] = React\.useState\(0\);/);
  assert.match(source, /focusGeneration: terminalFocusGeneration,/);
  const keys = slice("if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === 'F12')", "if (event.altKey && !event.metaKey && !event.ctrlKey && (event.key === '1'");
  assert.match(keys, /toggleTerminalDock\(\);/);
});

test('closing the dock through its own toolbar restores focus too', () => {
  const panel = source.slice(source.indexOf('onRequestNew: () => setTerminalGeneration'), source.indexOf('onEditorTerminals: (list)'));
  assert.match(panel, /onRequestClose: \(\) => \{/);
  assert.match(panel, /setTerminalOpen\(false\);/);
  assert.match(panel, /terminalReturnFocusRef\.current = null;/);
  assert.match(panel, /else editorRef\.current\?\.focus\(\);/);
});
