import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('./fixtures/terminal-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));

test('unsplitting returns keyboard ownership to the surviving terminal', () => {
  const start = terminal.indexOf('const toggleSplit = async () => {');
  const end = terminal.indexOf('      };', start);
  assert.ok(start >= 0 && end > start, 'toggleSplit is missing');
  const block = terminal.slice(start, end);
  assert.match(block, /setSplitId\(null\);/u);
  assert.match(block, /setFocusedPane\('left'\);/u);
  assert.match(block, /window\.setTimeout\(\(\) => emulatorRef\.current\?\.focus\?\.\(\), 0\);/u);
});
