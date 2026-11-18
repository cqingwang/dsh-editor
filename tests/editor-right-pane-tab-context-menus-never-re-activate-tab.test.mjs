import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const findToolSource = readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8');
const source = [
  findToolSource,
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
].join('\n');

const terminalTabContextFocus = loadTypeScriptFunction(findToolSource, 'terminalTabContextFocus');

test('right-pane tab context menus never re-activate that tab in the left pane', () => {
  assert.deepEqual(terminalTabContextFocus('t2', 't1', 't2'), { pane: 'right', activate: false });
  assert.deepEqual(terminalTabContextFocus('t1', 't1', 't2'), { pane: 'left', activate: true });
  assert.deepEqual(terminalTabContextFocus('t1', 't1', null), { pane: 'left', activate: true });
});

test('tab context menu uses the pane-aware focus decision before opening actions', () => {
  assert.match(source, /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+event\.currentTarget\.focus\?\.\(\);\s+openTerminalTabMenu\(terminal, event\.clientX, event\.clientY\);/s);
  const helper = source.slice(
    source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {'),
    source.indexOf('/**\n   * Open the hidden-terminal list', source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {')),
  );
  assert.match(helper, /const focus = terminalTabContextFocus\(terminal\.id, activeId, splitId\)/);
  assert.match(helper, /if \(focus\.activate\) setActiveId\(terminal\.id\)/);
  assert.match(helper, /setFocusedPane\(focus\.pane\)/);
  assert.doesNotMatch(helper, /\n\s+setActiveId\(terminal\.id\);\n\s+const leftTarget/);
});

test('a tab already shown in the right pane is not offered Split Right again', () => {
  const block = source.slice(
    source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {'),
    source.indexOf('/**\n   * Open the hidden-terminal list', source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {')),
  );
  assert.match(block, /splitRight:\s+terminal\.id === activeId \|\| terminal\.id === splitId\s+\? null\s+: \(\) =>/s);
});

test('the focus decision does not mutate terminal order or PTY identity', () => {
  const block = source.slice(
    source.indexOf('function terminalTabContextFocus('),
    source.indexOf('/**\n * Context menu for one terminal tab', source.indexOf('function terminalTabContextFocus(')),
  );
  assert.doesNotMatch(block, /setActiveId|setSplitId|callTerminal|moveTab/);
});
