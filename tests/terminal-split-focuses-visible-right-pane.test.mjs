import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('splitting with an existing terminal focuses the visible right pane', () => {
  const start = panel.indexOf('const candidate = terminals.find(');
  const end = panel.indexOf('/* Keep the existing shell on the left', start);
  assert.ok(start >= 0 && end > start, 'split candidate branch is missing');
  const candidate = panel.slice(start, end);

  assert.match(candidate, /setSplitId\(candidate\.id\);/u);
  assert.match(candidate, /setFocusedPane\('right'\);/u);
  assert.doesNotMatch(candidate, /setFocusedPane\('left'\);/u);
});

test('splitting with a newly created terminal also focuses the right pane', () => {
  const start = panel.indexOf('const created = await createTerminal();');
  const end = panel.indexOf('};', start);
  assert.ok(start >= 0 && end > start, 'new-terminal split branch is missing');
  const created = panel.slice(start, end);
  assert.match(created, /setSplitId\(created\.id\);/u);
  assert.match(created, /setFocusedPane\('right'\);/u);
});
