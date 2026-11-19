import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = [
  workspaceSource,
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
].join('\n');

/**
 * Slice one callback/handler body out of the client bundle.
 * @param {string} from - literal that starts the block.
 * @param {string} to - literal that ends it (first occurrence after `from`).
 * @returns {string} the slice.
 */
function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing from lib/client.js`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

/* ── tool windows are reachable from the keyboard ───────────────────────── */

test('Alt+1/2/3 raise Project, Commit and Terminal', () => {
  /* Round 140 listed this as remaining: the stripe had no keyboard path at all,
     so opening Commit meant reaching for the mouse. IDEA raises a tool window
     with Alt+<digit>. */
  const block = slice(
    '* Alt+F12, Alt+1..3 and Ctrl+Shift+`',
    '/* Keyboard navigation over the visible flattened rows. */',
  );
  assert.match(block, /event\.key === '1' \|\| event\.key === '2' \|\| event\.key === '3'/);
  assert.match(
    block,
    /event\.key === '3'[\s\S]*?toggleTerminalDock\(\);[\s\S]*?selectActivity\(event\.key === '1' \? 'project' : 'commit', \{ keyboard: true \}\)/,
  );
  /* The handler must not run twice for the same key: modifier-free Alt only. */
  assert.match(block, /if \(event\.altKey && !event\.metaKey && !event\.ctrlKey && event\.key === 'F12'\)/);
  /* It reads the CURRENT selectActivity instead of retaining the first render. */
  assert.match(block, /\}, \[selectActivity, terminalOpen\]\);/);
});

test('switching non-terminal tool windows keeps the terminal dock open', () => {
  /* It used to call setTerminalOpen(false), so looking at a diff killed the
     shells; IDEA keeps the terminal dock where it is. */
  const block = slice('const selectActivity = React.useCallback(', '* Alt+F12, Alt+1..3 and Ctrl+Shift+`');
  const nonTerminalBranch = block.slice(block.indexOf("if (next === 'terminal')") + 1);
  const projectBranch = nonTerminalBranch.slice(nonTerminalBranch.indexOf('if (next === activity)'));
  assert.doesNotMatch(projectBranch, /setTerminalOpen\(false\)/);
  assert.match(block, /if \(next === activity\) \{/);
  assert.match(block, /options\?\.keyboard === true/);
  assert.match(block, /toolWindowShortcutAction\(activity, next, panelVisibleRef\.current, focusInside\)/);
});

test('a focused side resizer belongs to the tool-window focus domain', () => {
  const block = slice('const selectActivity = React.useCallback(', '* Alt+F12, Alt+1..3 and Ctrl+Shift+`');
  assert.match(block, /data-dsh-editor-tool-window-resizer/u);
  assert.match(
    block,
    /toolWindowPanelRef\.current\?\.contains\(activeElement\) === true[\s\S]*?data-dsh-editor-tool-window-resizer/u,
  );
});

/* ── Project tree keeps the keyboard ────────────────────────────────────── */

test('a tree click leaves the caret in the tree', () => {
  /* The tree's keys (F2, Delete, ⌘R, typeahead) only fire from inside the tree,
     and opening a file used to move focus into Monaco. Measured before the fix:
     Shift+F6 / Alt+2 with a row clicked did nothing at all. */
  const block = slice('onMouseDown={(event) => {', 'onDoubleClick=');
  assert.match(block, /if \(event\.button !== 0\) return;/);
  assert.match(block, /treeRef\.current\?\.focus\(\);/);
  /* A click that lands on the inline rename field must not blur it. */
  assert.match(block, /event\.target\.closest\('input'\) !== null\) return;/);
});

test('the editor does not steal focus from a tree click', () => {
  const block = slice('const inlineEditing =', 'revealLines(activePath');
  assert.match(block, /const inTree = activeNode\?\.closest\('\[role="tree"\]'\) != null;/);
  assert.match(block, /if \(!inlineEditing && !inTree && !inTabs\) editor\.focus\(\);/);
});

test('⇧F6 renames the selected row and ⌘R refreshes the tree', () => {
  const handler = slice('const onTreeKeyDown = React.useCallback(', 'const toggleCommitPath = React.useCallback(');
  /* Both are printed in the row context menu, so both must exist as keys.
     Round 144 split them: ⇧F6 renames, F6 alone opens IDEA's "Move to…". */
  assert.match(handler, /case 'F6':/);
  assert.match(handler, /if \(event\.shiftKey\) \{/);
  assert.match(handler, /void openMoveTo\(/);
  assert.match(handler, /event\.key\.toLowerCase\(\) === 'r'/);
  assert.match(handler, /void refreshTree\(\);/);
  assert.match(handler, /\[[^\]]*\bexpanded\b[^\]]*\bopenMoveTo\b[^\]]*\brefreshTree\b/);
});

/* ── Commit: keyboard staging and diff ──────────────────────────────────── */

test('⌘⇧A stages and ⌥⌘A unstages the current change', () => {
  const block = slice('const stageShortcut = React.useCallback(', '/**\n   * ⌘D');
  assert.match(block, /event\.shiftKey === event\.altKey/);
  assert.match(block, /activityRef\.current !== 'commit'/);
  /* The band decides the direction, read from the live git snapshot. */
  assert.match(block, /const staged =\s+change\.status\[0\] !== ' ' && change\.status\[0\] !== '\?';/);
  assert.match(block, /void restageRef\.current\(\[\.\.\.new Set\(eligible\)\], staged\);/);
  /* Text fields and the terminal keep the key. */
  assert.match(block, /closest\('\.monaco-editor'\)/);
  assert.match(block, /closest\('\[data-dsh-editor-terminal\]'\)/);
});

test('⌘D toggles the diff of the change the panel is showing', () => {
  const block = slice(
    'const showDiffShortcut = React.useCallback(',
    "window.addEventListener('keydown', showDiffShortcut, true);",
  );
  assert.match(block, /event\.key\.toLowerCase\(\) !== 'd'/);
  assert.match(
    block,
    /setDiffTarget\(\(current\) =>\s+current !== null && current\.path === path && current\.staged === staged \? null : \{ path, staged \},\s+\);/s,
  );
});

test('the last change survives closing the diff, so ⌘D can reopen it', () => {
  class FakeElement {
    closest() {
      return null;
    }
  }
  let nextDiff = null;
  const showDiffShortcut = loadTypeScriptCallback(workspaceSource, 'showDiffShortcut', {
    selectedGroupRef: { current: null },
    lastChangePathRef: { current: { path: 'a.ts', staged: false } },
    selectedChangeRef: { current: null },
    selectedDiffPathRef: { current: null },
    selectedCommitPathRef: { current: null },
    activePathRef: { current: null },
    gitRef: { current: { changes: [{ path: 'a.ts', status: ' M' }] } },
    panelVisibleRef: { current: true },
    activityRef: { current: 'commit' },
    setDiffTarget: (updater) => {
      nextDiff = updater(nextDiff);
    },
    setDiffActive: () => {},
    Element: FakeElement,
  });
  const event = {
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: 'd',
    target: null,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
  showDiffShortcut(event);
  assert.deepEqual(nextDiff, { path: 'a.ts', staged: false });
  showDiffShortcut(event);
  assert.equal(nextDiff, null);
});

/* ── Terminal keys its own menu advertises ──────────────────────────────── */

test('⌘A selects the whole terminal buffer and ⇧F6 renames the tab', () => {
  const block = slice('/* ⌘A selects the whole buffer', '/* ⌘⇧C copies the selection');
  assert.match(block, /emulator\.selectAll\(\);/);
  assert.match(block, /event\.key === 'F6'/);
  assert.match(
    block,
    /setRenaming\(\{\s+id: terminal\.id,\s+value: terminal\.title,\s+previous: terminal\.title,\s+\}\);/s,
  );
  /* The rename acts on the pane the caret is in, like ⌘1–⌘9 and ⌥←/→ do. */
  assert.match(
    block,
    /focusedPaneRef\.current === 'right' && splitIdRef\.current !== null \? splitIdRef\.current : activeRef\.current/s,
  );
});

/* ── Project sort keeps the selected row on screen ──────────────────────── */

test('a re-sort scrolls the selected row back into view', () => {
  const block = slice("if (sortAppliedRef.current === '')", '/**\n   * Toggle IDEA\'s "Open Files with Single Click"');
  assert.match(block, /if \(sortAppliedRef\.current === sortMode\) return;/);
  assert.match(block, /const path = selectedPathRef\.current;/);
  assert.match(block, /row\.scrollIntoView\(\{ block: 'nearest' \}\);/);
  /* The first pass only records the initial mode: mounting must not scroll. */
  assert.match(block, /if \(sortAppliedRef\.current === ''\) \{/);
  /* The row may not exist for a frame after the reload. */
  assert.match(block, /if \(tries < 20\) window\.requestAnimationFrame\(tick\);/);
});
