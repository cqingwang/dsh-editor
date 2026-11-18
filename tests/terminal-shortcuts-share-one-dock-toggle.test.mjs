import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = source.indexOf('\n    }', start) + '\n    }'.length;
  return new Function(`${source.slice(start, end)}; return ${name};`)();
}

test('both terminal shortcuts share one dock toggle', () => {
  const start = source.indexOf('Alt+F12, Alt+1..3 and Ctrl+Shift+`');
  const end = source.indexOf("}, [selectActivity, terminalOpen]);", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /const toggleTerminalDock = \(\) => \{/);

  const altStart = handler.indexOf('event.altKey && !event.metaKey && !event.ctrlKey && event.key === \'F12\'');
  const digitStart = handler.indexOf('event.altKey && !event.metaKey && !event.ctrlKey && (event.key === \'1\'');
  const altBlock = handler.slice(altStart, digitStart);
  const ctrlStart = handler.indexOf('event.ctrlKey && event.shiftKey');
  const ctrlBlock = handler.slice(ctrlStart);
  assert.match(altBlock, /toggleTerminalDock\(\);/);
  assert.match(ctrlBlock, /toggleTerminalDock\(\);/);
  assert.doesNotMatch(ctrlBlock, /setTerminalGeneration/);
});

test('a terminal shortcut never creates a new shell just to toggle the dock', () => {
  const start = source.indexOf('Alt+F12, Alt+1..3 and Ctrl+Shift+`');
  const end = source.indexOf("}, [selectActivity, terminalOpen]);", start);
  const handler = source.slice(start, end);
  const toggleStart = handler.indexOf('const toggleTerminalDock = () => {');
  const toggleEnd = handler.indexOf('const onKeyDown = (event) => {', toggleStart);
  const toggle = handler.slice(toggleStart, toggleEnd);
  assert.match(toggle, /setTerminalOpen\(true\)/);
  assert.match(toggle, /setTerminalFocusGeneration/);
  assert.doesNotMatch(toggle, /setTerminalGeneration/);
});

test('terminalShortcutAction closes an open dock and only restores focus from inside', () => {
  const action = load('terminalShortcutAction');
  assert.deepEqual(action(true, true), { open: false, restoreFocus: true });
  assert.deepEqual(action(true, false), { open: false, restoreFocus: false });
  assert.deepEqual(action(false, true), { open: true, restoreFocus: false });
  assert.deepEqual(action(false, false), { open: true, restoreFocus: false });
});
