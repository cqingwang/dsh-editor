import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const normalizeTerminalDockLayout = loadTypeScriptFunction(terminalSource, 'normalizeTerminalDockLayout');
const restoreTerminalFocusTarget = loadTypeScriptFunction(terminalSource, 'restoreTerminalFocusTarget');

test('Terminal dock layout keeps a valid active/split pair and focused pane', () => {
  assert.deepEqual(
    normalizeTerminalDockLayout({
      activeId: 'left',
      splitId: 'right',
      focusedPane: 'right',
    }),
    {
      activeId: 'left',
      splitId: 'right',
      focusedPane: 'right',
    },
  );
});

test('Terminal dock layout rejects malformed or duplicated pane identities', () => {
  assert.equal(normalizeTerminalDockLayout(null), null);
  assert.equal(normalizeTerminalDockLayout({ splitId: 'right', focusedPane: 'right' }), null);
  assert.deepEqual(
    normalizeTerminalDockLayout({
      activeId: 'same',
      splitId: 'same',
      focusedPane: 'right',
    }),
    {
      activeId: 'same',
      splitId: null,
      focusedPane: 'left',
    },
  );
});

test('TerminalPanel restores layout state before validating host terminals', () => {
  assert.match(panelSource, /initialDockLayoutRef = React\.useRef\(readTerminalDockLayout\(\)\)/u);
  assert.match(panelSource, /initialDockLayoutRef\.current\?\.splitId \?\? null/u);
  assert.match(panelSource, /initialDockLayoutRef\.current\?\.focusedPane \?\? 'left'/u);
  assert.match(panelSource, /if \(!loaded\) return;[\s\S]*?setSplitId\(null\)/u);
  assert.match(panelSource, /writeTerminalDockLayout\(\{[\s\S]*?activeId,[\s\S]*?splitId,[\s\S]*?focusedPane,/u);
});

test('Terminal close restores a connected preferred surface or calls the fallback', () => {
  let focused = null;
  let fallbacks = 0;
  const preferred = {
    isConnected: true,
    focus: (options) => {
      focused = options;
    },
  };
  restoreTerminalFocusTarget(preferred, () => {
    fallbacks += 1;
  });
  assert.deepEqual(focused, { preventScroll: true });
  assert.equal(fallbacks, 0);

  restoreTerminalFocusTarget(
    {
      isConnected: false,
      focus: () => {
        throw new Error('a disconnected surface must not receive focus');
      },
    },
    () => {
      fallbacks += 1;
    },
  );
  assert.equal(fallbacks, 1);
});
