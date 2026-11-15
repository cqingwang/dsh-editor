import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Slice one callback/JSX block out of the client bundle.
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

/* ── The dock is chrome-free: no cwd / grid footer ─────────────────────── */

test('the terminal dock has no cwd + grid footer row', () => {
  /* `path  90×10` cost 20px at the bottom of a dock that is often only 200px
     tall, and the path already lives in the tab's tooltip. */
  assert.doesNotMatch(source, /`\$\{grid\.cols\}×\$\{grid\.rows\}`/);
  /* The panel still hands the grid callback to the screen; it just ignores it. */
  assert.match(source, /onGrid: \(\) => \{\},/);
  /* No render state is kept for a readout nobody sees any more. */
  assert.doesNotMatch(source, /const \[grid, setGrid\] = React\.useState/);
  assert.doesNotMatch(source, /noTerminal/);
  /* The failure strip stays: an error still has to be visible somewhere. */
  const tail = slice("menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),", 'function terminalTheme');
  assert.match(tail, /styles\.terminalStatusBar/);
  assert.match(tail, /t\('editor\.terminalUnavailable'\)|error === null\n\s+\? null/);
});

/* ── One title row, not two ─────────────────────────────────────────────── */

test('the dock title row is gone and the hide control moved into the tab strip', () => {
  /* "Terminal  –" repeated what the tab strip directly below already showed. */
  assert.doesNotMatch(source, /styles\.dockHeader/);
  assert.doesNotMatch(source, /styles\.dockTitle/);
  assert.doesNotMatch(source, /React\.createElement\('span', \{ style: styles\.dockTitle \}, t\('editor\.terminal'\)\)/);

  /* Hide lives at the end of the strip's tool cluster, after Options. */
  const strip = slice("label: t('editor.terminalOptions'),", 'find === null');
  assert.match(strip, /onRequestClose === undefined\n\s+\? null/);
  assert.match(strip, /React\.createElement\(ToolbarButton, \{ icon: 'hide', label: t\('editor\.hideTerminal'\), onClick: \(\) => onRequestClose\(\) \}\)/);
  /* It reaches the panel as a prop: a tool window cannot close itself. */
  assert.match(source, /onRequestClose: \(\) => \{[\s\S]*?setTerminalOpen\(false\);/);
  assert.match(source, /hideTerminal: '隐藏终端面板',/);
  assert.match(source, /hideTerminal: 'Hide terminal',/);
});

test('the dock keeps exactly one strip above the screen', () => {
  /* The panel is `tabStrip` then the screen; a third row means chrome crept back. */
  assert.match(source, /function TerminalPanel\(\{ t, generation, startDirectory, workspaceRoot = '', onStartDirectoryUsed, onRequestNew, onRequestClose, onOpenFile, onEditorTerminals, onSwitchFocusToEditor, focusGeneration = 0 \}\)/);
  const panel = slice('function TerminalPanel(', 'function terminalTheme');
  assert.match(panel, /style: styles\.terminalTabStrip/);
  /* The resize grip belongs to the DOCK, above the panel — not to the panel. */
  assert.doesNotMatch(panel, /styles\.dockResize/);
  assert.match(source, /style: \{ \.\.\.styles\.dockResize, cursor: dockDragging \? 'row-resize' : 'row-resize' \},/);
});
