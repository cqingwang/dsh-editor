import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('..', import.meta.url);
const helpersSource = await readFile(new URL('src/client/find-tool.ts', root), 'utf8');
const panelSource = await readFile(new URL('src/client/components/terminal/TerminalPanel.tsx', root), 'utf8');
const helpers = loadTypeScriptModule(helpersSource, ['terminalScreenMenuKeyboardRequest']);

test('terminal screen menu keyboard request accepts only IDEA context-menu chords', () => {
  assert.equal(helpers.terminalScreenMenuKeyboardRequest({ key: 'F10', shiftKey: true }), true);
  assert.equal(helpers.terminalScreenMenuKeyboardRequest({ key: 'ContextMenu' }), true);
  assert.equal(helpers.terminalScreenMenuKeyboardRequest({ key: 'F10', shiftKey: false }), false);
  assert.equal(helpers.terminalScreenMenuKeyboardRequest({ key: 'F10', shiftKey: true, metaKey: true }), false);
  assert.equal(helpers.terminalScreenMenuKeyboardRequest({ key: 'ContextMenu', ctrlKey: true }), false);
  assert.equal(helpers.terminalScreenMenuKeyboardRequest(null), false);
});

test('both terminal panes open the shared screen menu from the keyboard', () => {
  assert.match(panelSource, /terminalScreenMenuKeyboardRequest/u);
  assert.match(panelSource, /const openScreenMenuFromKeyboard = \(/u);
  assert.match(panelSource, /event\.currentTarget\.getBoundingClientRect\(\)/u);
  assert.match(panelSource, /getSelectionPosition\?\.\(\)/u);
  assert.match(
    panelSource,
    /data-dsh-terminal-pane-role='left'[\s\S]*?onKeyDownCapture=\{\(event\) =>\s+openScreenMenuFromKeyboard\(event, emulatorRef\.current, active, 'left'\),?\s*\}/u,
  );
  assert.match(
    panelSource,
    /data-dsh-terminal-pane-role='right'[\s\S]*?onKeyDownCapture=\{\(event\) =>\s+openScreenMenuFromKeyboard\(event, splitEmulatorRef\.current, splitTerminal, 'right'\),?\s*\}/u,
  );
});
