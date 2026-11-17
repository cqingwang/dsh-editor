import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));

test('Close Other Terminals converges locally before waiting for the host', () => {
  const start = terminal.indexOf('const closeOtherTerminals = React.useCallback(');
  const end = terminal.indexOf('        [rememberClosed],', start);
  assert.ok(start >= 0 && end > start, 'closeOtherTerminals is missing');
  const block = terminal.slice(start, end);
  const localUpdate = block.indexOf('setTerminals(remaining);');
  const hostClose = block.indexOf('await Promise.all(');
  assert.ok(localUpdate >= 0 && hostClose > localUpdate);
  assert.match(block, /const remaining = current\.filter\(\(terminal\) => terminal\.id === keepId\);/u);
});

test('Close Other Terminals records closed tabs and focuses the survivor', () => {
  const start = terminal.indexOf('const closeOtherTerminals = React.useCallback(');
  const end = terminal.indexOf('        [rememberClosed],', start);
  const block = terminal.slice(start, end);
  assert.match(block, /for \(const terminal of doomed\) \{[\s\S]*?rememberClosed\(terminal\);/u);
  assert.match(block, /setSplitId\(null\);/u);
  assert.match(block, /setFocusedPane\('left'\);/u);
  assert.match(block, /window\.setTimeout\(\(\) => emulatorRef\.current\?\.focus\?\.\(\), 0\);/u);
});
