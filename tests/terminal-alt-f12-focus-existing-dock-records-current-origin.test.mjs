import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractVariableInitializerExpression, loadTypeScriptExpression } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function loadToggleTerminalDock({ focusInsideTerminal }) {
  const events = [];
  let focusGeneration = 0;
  let terminalOpen = true;

  class FakeElement {
    closest(selector) {
      return selector === '[data-dsh-editor-terminal]' && focusInsideTerminal ? {} : null;
    }
  }

  const toggleTerminalDock = loadTypeScriptExpression(
    workspaceSource,
    extractVariableInitializerExpression(workspaceSource, 'toggleTerminalDock'),
    {
      document: { activeElement: new FakeElement() },
      Element: FakeElement,
      terminalShortcutAction: () =>
        focusInsideTerminal
          ? { open: false, restoreFocus: true, focus: false }
          : { open: true, restoreFocus: false, focus: true },
      terminalOpen,
      terminalReturnFocusRef: { current: null },
      setTerminalOpen: (value) => {
        terminalOpen = value;
        events.push(['open', value]);
      },
      restoreTerminalOrigin: () => events.push(['restore']),
      rememberTerminalOrigin: () => events.push(['remember']),
      setFindTool: (value) => events.push(['find', value]),
      setTerminalFocusGeneration: (updater) => {
        focusGeneration = updater(focusGeneration);
        events.push(['focus', focusGeneration]);
      },
    },
  );

  toggleTerminalDock();
  return { events, focusGeneration, terminalOpen };
}

test('focusing an already-open Terminal records the surface requesting it', () => {
  const result = loadToggleTerminalDock({ focusInsideTerminal: false });

  assert.equal(result.terminalOpen, true);
  assert.equal(result.focusGeneration, 1);
  assert.deepEqual(result.events, [
    ['remember'],
    ['find', null],
    ['focus', 1],
  ]);
});

test('a shortcut already inside the Terminal never replaces its return origin', () => {
  const result = loadToggleTerminalDock({ focusInsideTerminal: true });

  assert.equal(result.terminalOpen, false);
  assert.equal(result.focusGeneration, 0);
  assert.deepEqual(result.events, [['open', false], ['restore']]);
});
