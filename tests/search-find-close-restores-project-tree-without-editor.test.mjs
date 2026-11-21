import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Find captures the opener and restores a connected Project tree without an editor', () => {
  assert.match(
    workspaceSource,
    /document\.querySelector\('\[data-dsh-find-tool-window\]'\) === null[\s\S]*?findToolReturnFocusRef\.current = activeElement;/u,
  );

  let closed = false;
  let previousFocused = false;
  const previous = {
    isConnected: true,
    focus() {
      previousFocused = true;
    },
  };
  const findToolReturnFocusRef = { current: previous };
  let currentEditorRequested = false;
  const closeFindToolWindow = loadTypeScriptCallback(workspaceSource, 'closeFindToolWindow', {
    findToolReturnFocusRef,
    setFindTool: (value) => {
      closed = value === null;
    },
    findDockState: {
      setMinimized: () => {},
      restoreTerminalAfterFind: () => false,
    },
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    currentCodePath: () => null,
    currentCodeEditor: () => {
      currentEditorRequested = true;
      return null;
    },
    document: { querySelector: () => null },
    focusWorkspaceFallback: () => false,
  });
  closeFindToolWindow();
  assert.equal(closed, true);
  assert.equal(previousFocused, true);
  assert.equal(currentEditorRequested, false);
  assert.equal(findToolReturnFocusRef.current, null);
});
