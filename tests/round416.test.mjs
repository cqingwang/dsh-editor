import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const panel = source.slice(
  source.indexOf('function TerminalPanel('),
  source.indexOf('function EditorWorkspace('),
);

test('the terminal overflow button exposes the hidden-tab menu builder', () => {
  assert.match(panel, /const openTerminalOverflowMenu = \(anchor\) => \{/);
  assert.match(panel, /x: Math\.max\(4, anchor\.right - 188\)/);
  assert.match(panel, /items: tabLayout\.hidden\.map\(\(terminal\) => \(\{/);
  assert.match(panel, /id: `tab:\$\{terminal\.id\}`/);
});

test('Shift+F10 and ContextMenu open the same overflow menu as a click', () => {
  const overflow = panel.slice(
    panel.indexOf("className: 'dsh-editor-terminal-overflow'"),
    panel.indexOf("'»'", panel.indexOf("className: 'dsh-editor-terminal-overflow'")),
  );
  assert.match(overflow, /onClick: \(event\) => \{\s+openTerminalOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  assert.match(overflow, /onContextMenu: \(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+openTerminalOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  assert.match(overflow, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
});
