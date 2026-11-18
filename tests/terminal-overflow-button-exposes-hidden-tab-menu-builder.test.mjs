import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('the terminal overflow button exposes the hidden-tab menu builder', () => {
  assert.match(panel, /const openTerminalOverflowMenu = \(anchor(?::\s*[^)]+)?\)(?::\s*[^{]+)?/);
  assert.match(panel, /x: Math\.max\(4, anchor\.right - 188\)/);
  assert.match(panel, /items: tabLayout\.hidden\.map\(\(terminal\) => \(\{/);
  assert.match(panel, /id: `tab:\$\{terminal\.id\}`/);
});

test('Shift+F10 and ContextMenu open the same overflow menu as a click', () => {
  const overflow = panel.slice(
    panel.indexOf("className='dsh-editor-terminal-overflow'"),
    panel.indexOf('</button>', panel.indexOf("className='dsh-editor-terminal-overflow'")),
  );
  assert.match(overflow, /onClick=\{\(event\) => \{\s+openTerminalOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  assert.match(overflow, /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+event\.currentTarget\.focus\?\.\(\);\s+openTerminalOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  assert.match(overflow, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
});
