import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\nexport { TerminalPanel };', terminalStart));

test('closing a terminal updates local tabs before waiting for the host', () => {
  const start = terminal.indexOf('const closeTerminal = React.useCallback(');
  const end = terminal.indexOf('    [rememberClosed],', start);
  assert.ok(start >= 0 && end > start, 'closeTerminal is missing');
  const block = terminal.slice(start, end);
  const localRemoval = block.indexOf('setTerminals(remaining);');
  const hostClose = block.indexOf("await callTerminal({");
  assert.notEqual(hostClose, -1);
  assert.match(block.slice(hostClose), /await callTerminal\(\{\s+op: 'close',\s+id,\s+\}\);/);
  assert.ok(localRemoval >= 0 && hostClose > localRemoval);
  assert.match(block, /const remaining = terminalsRef\.current\.filter\(\(terminal\) => terminal\.id !== id\);/u);
  assert.match(block, /writeTerminalRestoreSnapshots\(\[\]\)/u);
});

test('closing the focused split pane returns focus to the survivor', () => {
  const start = terminal.indexOf('const closeTerminal = React.useCallback(');
  const end = terminal.indexOf('    [rememberClosed],', start);
  const block = terminal.slice(start, end);
  assert.match(block, /const focusedId = focusedPaneRef\.current === 'right' \? splitIdRef\.current : activeRef\.current;/u);
  assert.match(block, /if \(focusedId === id\) \{\s+window\.setTimeout\(\(\) => emulatorRef\.current\?\.focus\?\.\(\), 0\);\s+\}/u);
});
