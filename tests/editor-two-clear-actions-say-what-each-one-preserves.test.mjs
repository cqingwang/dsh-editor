import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** The two clear operations must be distinguishable without reading a tooltip. */
test('the two clear actions say what each one preserves', () => {
  assert.ok(source.includes("terminalClear: '清屏（保留滚动缓冲）'"));
  assert.ok(source.includes("terminalClearBuffer: '清屏并清除滚动缓冲（历史一并丢弃）'"));
  assert.ok(source.includes("terminalClear: 'Clear screen (keeps scrollback)'"));
  assert.ok(source.includes("terminalClearBuffer: 'Clear screen and scrollback (drops history)'"));
});

test('the screen menu shows the ⌘K shortcut on the non-destructive clear', () => {
  const start = source.indexOf('function terminalMenuModel(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('function terminalTabMenu(', start));
  assert.match(block, /id: 'clear', label: t\('editor\.terminalClear'\), shortcut: '⌘K'/);
  /* The destructive one stays marked as such, without a shortcut hint. */
  assert.match(block, /id: 'clearBuffer', label: t\('editor\.terminalClearBuffer'\), danger: true/);
});
