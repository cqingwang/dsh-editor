import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const hookSource = await readFile(
  new URL('../src/client/components/editor/use-find-dock-slot-state.ts', import.meta.url),
  'utf8',
);

test('taking the shared bottom slot remembers a visible Terminal dock', () => {
  const findDockRestoreTerminalRef = { current: false };
  const terminalStates = [];
  const claimFindDockSlot = loadTypeScriptFunction(hookSource, 'claimFindDockSlot');

  claimFindDockSlot(true, findDockRestoreTerminalRef, (value) => terminalStates.push(value));

  assert.equal(findDockRestoreTerminalRef.current, true);
  assert.deepEqual(terminalStates, [false]);
});

test('a closed Terminal does not schedule restoration for Find dock', () => {
  const findDockRestoreTerminalRef = { current: false };
  const terminalStates = [];
  const claimFindDockSlot = loadTypeScriptFunction(hookSource, 'claimFindDockSlot');

  claimFindDockSlot(false, findDockRestoreTerminalRef, (value) => terminalStates.push(value));

  assert.equal(findDockRestoreTerminalRef.current, false);
  assert.deepEqual(terminalStates, [false]);
});

test('taking the pending Terminal restoration consumes it exactly once', () => {
  const findDockRestoreTerminalRef = { current: true };
  const takeFindDockTerminalRestore = loadTypeScriptFunction(hookSource, 'takeFindDockTerminalRestore');

  const restored = takeFindDockTerminalRestore(findDockRestoreTerminalRef);
  const consumedAgain = takeFindDockTerminalRestore(findDockRestoreTerminalRef);

  assert.equal(restored, true);
  assert.equal(consumedAgain, false);
  assert.equal(findDockRestoreTerminalRef.current, false);
});

test('closing displaced Find dock restores Terminal instead of focusing the editor', () => {
  const focusGenerations = [];
  let terminalRestores = 0;
  let editorFocuses = 0;
  let findState = { surface: 'dock' };
  const closeFindToolWindow = loadTypeScriptCallback(workspaceSource, 'closeFindToolWindow', {
    findToolReturnFocusRef: { current: null },
    closeFindPopupSession: () => false,
    setFindTool: (value) => {
      findState = value;
    },
    findToolSessionsRef: {
      current: {
        active: findState,
        activeId: 'find-1',
        sessions: [{ id: 'find-1', state: findState }],
        close: () => {},
      },
    },
    findDockState: {
      setMinimized: () => {},
      restoreTerminalAfterFind: () => {
        terminalRestores += 1;
        return true;
      },
    },
    setTerminalFocusGeneration: (update) => focusGenerations.push(update(2)),
    currentCodePath: () => 'src/client/editor-workspace.tsx',
    currentCodeEditor: () => ({
      focus: () => {
        editorFocuses += 1;
      },
    }),
    focusWorkspaceFallback: () => {},
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });

  closeFindToolWindow();

  assert.equal(findState, null);
  assert.equal(terminalRestores, 1);
  assert.deepEqual(focusGenerations, [3]);
  assert.equal(editorFocuses, 0);
});
