import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractUseEffectExpressionContaining,
  loadTypeScriptExpression,
  loadTypeScriptFunction,
} from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const terminalSource = await read('src/client/terminal.ts');
const panelSource = await read('src/client/components/terminal/TerminalPanel.tsx');
const recover = loadTypeScriptFunction(terminalSource, 'terminalOverflowFocusRecovery');
const recoveryEffect = extractUseEffectExpressionContaining(panelSource, 'terminalOverflowFocusRecovery(');

test('overflow removal recovers focus only when the overflow owned focus and vanished', () => {
  assert.equal(recover(1, 0, true, 'terminal-a'), 'terminal-a');
  assert.equal(recover(3, 0, true, 'terminal-b'), 'terminal-b');
  assert.equal(recover(0, 0, true, 'terminal-a'), null);
  assert.equal(recover(1, 1, true, 'terminal-a'), null);
  assert.equal(recover(1, 0, false, 'terminal-a'), null);
  assert.equal(recover(1, 0, true, null), null);
  assert.equal(recover(1, 0, true, ''), null);
});

test('the TerminalPanel effect restores the active tab only after overflow removal drops focus to body', () => {
  const calls = [];
  const previousHiddenTerminalCountRef = { current: 1 };
  const effect = loadTypeScriptExpression(panelSource, recoveryEffect, {
    activeId: 'terminal-a',
    document: {
      activeElement: null,
      body: {},
    },
    focusTerminalTabById: (strip, terminalId) => calls.push([strip, terminalId]),
    previousHiddenTerminalCountRef,
    tabLayout: { hidden: [] },
    tabStripRef: { current: { id: 'strip' } },
    terminalOverflowFocusRecovery: recover,
  });

  effect();
  assert.deepEqual(calls, [[{ id: 'strip' }, 'terminal-a']]);
  assert.equal(previousHiddenTerminalCountRef.current, 0);

  calls.length = 0;
  previousHiddenTerminalCountRef.current = 1;
  const otherFocusEffect = loadTypeScriptExpression(panelSource, recoveryEffect, {
    activeId: 'terminal-a',
    document: {
      activeElement: { isConnected: true },
      body: {},
    },
    focusTerminalTabById: (strip, terminalId) => calls.push([strip, terminalId]),
    previousHiddenTerminalCountRef,
    tabLayout: { hidden: [] },
    tabStripRef: { current: { id: 'strip' } },
    terminalOverflowFocusRecovery: recover,
  });
  otherFocusEffect();
  assert.deepEqual(calls, []);
});
