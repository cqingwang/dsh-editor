import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractVariableInitializerExpression, loadTypeScriptExpression } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screenSource = readFileSync(join(root, 'src/client/components/terminal/TerminalScreen.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = `${readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8')}\n${screenSource}\n${workspaceSource}`;

function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

test('the terminal screen reclaims focus whenever it becomes visible', () => {
  const screen = screenSource;
  assert.match(screen, /const \[visible, setVisible\] = React\.useState\(false\);/);
  assert.match(screen, /const setHostNode = React\.useCallback\(\(node(?:\s*:\s*[^)]+)?\) =>/);
  assert.match(screen, /node\.getBoundingClientRect\(\)/);
  assert.match(screen, /node\.offsetParent !== null/);
  assert.match(
    screen,
    /reclaimFocus = true/,
  );
  assert.match(
    screen,
    /if \(!ready \|\| reclaimFocus !== true\) return;[\s\S]*?emulatorRef\.current\?\.focus\(\);[\s\S]*?\}, \[ready, reclaimFocus, visible, focusGeneration\]\);/,
  );
  assert.match(screen, /ref=\{setHostNode\}/);
  assert.match(screen, /focusGeneration = 0/);
});

test('only the focused split pane reclaims visibility focus', () => {
  assert.match(
    source,
    /<TerminalScreen\s+terminalId=\{activeId\}[\s\S]*?focusGeneration=\{focusedPane === 'left' \? focusGeneration : 0\}[\s\S]*?reclaimFocus=\{focusedPane === 'left'\}/u,
  );
  assert.match(
    source,
    /<TerminalScreen\s+terminalId=\{splitId\}[\s\S]*?focusGeneration=\{focusedPane === 'right' \? focusGeneration : 0\}[\s\S]*?reclaimFocus=\{focusedPane === 'right'\}/u,
  );
});

test('Alt+F12 records the originating surface and restores it on close', () => {
  class ToggleElement {
    closest() {
      return null;
    }
  }
  const activeElement = new ToggleElement();
  const events = [];
  let terminalOpen = false;
  let focusGeneration = 0;
  const toggleTerminalDock = loadTypeScriptExpression(
    workspaceSource,
    extractVariableInitializerExpression(workspaceSource, 'toggleTerminalDock'),
    {
      document: { activeElement },
      Element: ToggleElement,
      terminalShortcutAction: () => ({ open: true, restoreFocus: false }),
      terminalOpen,
      terminalReturnFocusRef: { current: null },
      rememberTerminalOrigin: () => events.push('remember'),
      restoreTerminalOrigin: () => events.push('restore'),
      setTerminalOpen: (value) => {
        terminalOpen = value;
      },
      setFindTool: () => events.push('clear-find'),
      setTerminalFocusGeneration: (updater) => {
        focusGeneration = updater(focusGeneration);
      },
    },
  );
  toggleTerminalDock();
  assert.equal(terminalOpen, true);
  assert.equal(focusGeneration, 1);
  assert.deepEqual(events, ['remember', 'clear-find']);

  class FakeElement {
    constructor() {
      this.isConnected = true;
      this.focused = false;
    }
    focus() {
      this.focused = true;
    }
  }
  const previous = new FakeElement();
  const terminalReturnFocusRef = { current: previous };
  const restoreTerminalOrigin = loadTypeScriptExpression(
    workspaceSource,
    extractVariableInitializerExpression(workspaceSource, 'restoreTerminalOrigin'),
    {
      terminalReturnFocusRef,
      focusWorkspaceSurface: (preferred) => preferred?.focus?.(),
    },
  );
  restoreTerminalOrigin();
  assert.equal(previous.focused, true);
  assert.equal(terminalReturnFocusRef.current, null);
});

test('closing the dock through its own toolbar restores focus too', () => {
  const panel = workspaceSource.slice(
    workspaceSource.indexOf('onRequestNew={() => setTerminalGeneration'),
    workspaceSource.indexOf('onEditorTerminals={(list)'),
  );
  assert.match(panel, /onRequestClose=\{\(\) => \{/);
  assert.match(panel, /setTerminalOpen\(false\);/);
  assert.match(panel, /terminalReturnFocusRef\.current = null;/);
  assert.match(panel, /focusWorkspaceSurface\(previous\);/);
});
