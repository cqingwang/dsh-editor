import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const helperSource = readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8');
const terminalShortcutAction = loadTypeScriptModule(helperSource, ['terminalShortcutAction']).terminalShortcutAction;

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

test('terminalShortcutAction focuses a visible inactive dock before closing it from inside', () => {
  assert.deepEqual(terminalShortcutAction(true, true), { open: false, restoreFocus: true, focus: false });
  assert.deepEqual(terminalShortcutAction(true, false), { open: true, restoreFocus: false, focus: true });
  assert.deepEqual(terminalShortcutAction(false, true), { open: true, restoreFocus: false, focus: false });
  assert.deepEqual(terminalShortcutAction(false, false), { open: true, restoreFocus: false, focus: false });
});
