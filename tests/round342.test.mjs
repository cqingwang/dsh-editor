import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
}

const terminalTabContextFocus = new Function(
  `${extractFunction('terminalTabContextFocus')}; return terminalTabContextFocus;`,
)();

test('right-pane tab context menus never re-activate that tab in the left pane', () => {
  assert.deepEqual(terminalTabContextFocus('t2', 't1', 't2'), { pane: 'right', activate: false });
  assert.deepEqual(terminalTabContextFocus('t1', 't1', 't2'), { pane: 'left', activate: true });
  assert.deepEqual(terminalTabContextFocus('t1', 't1', null), { pane: 'left', activate: true });
});

test('tab context menu uses the pane-aware focus decision before opening actions', () => {
  const block = source.slice(
    source.indexOf('onContextMenu: (event) => {', source.indexOf('tabLayout.visible.map')),
    source.indexOf('colors[terminal.id] === undefined', source.indexOf('tabLayout.visible.map')),
  );
  assert.match(block, /openTerminalTabMenu\(terminal, event\.clientX, event\.clientY\)/);
  const helper = source.slice(
    source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {'),
    source.indexOf('return React.createElement(', source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {')),
  );
  assert.match(helper, /const focus = terminalTabContextFocus\(terminal\.id, activeId, splitId\)/);
  assert.match(helper, /if \(focus\.activate\) setActiveId\(terminal\.id\)/);
  assert.match(helper, /setFocusedPane\(focus\.pane\)/);
  assert.doesNotMatch(helper, /\n\s+setActiveId\(terminal\.id\);\n\s+const leftTarget/);
});

test('a tab already shown in the right pane is not offered Split Right again', () => {
  const block = source.slice(
    source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {'),
    source.indexOf('return React.createElement(', source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {')),
  );
  assert.match(block, /splitRight: terminal\.id === activeId \|\| terminal\.id === splitId \? null : \(\) =>/);
});

test('the focus decision does not mutate terminal order or PTY identity', () => {
  const block = source.slice(
    source.indexOf('function terminalTabContextFocus('),
    source.indexOf('/**\n     * Context menu for one terminal tab'),
  );
  assert.doesNotMatch(block, /setActiveId|setSplitId|callTerminal|moveTab/);
});
