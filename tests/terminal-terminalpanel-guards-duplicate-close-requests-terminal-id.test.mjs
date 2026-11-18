import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\nexport { TerminalPanel };', terminalStart));

test('TerminalPanel guards duplicate close requests by terminal id', () => {
  assert.match(terminal, /const closingTerminalIdsRef = React\.useRef\(new Set\(\)\);/u);
  const start = terminal.indexOf('const closeTerminal = React.useCallback(');
  const end = terminal.indexOf('    [rememberClosed],', start);
  const block = terminal.slice(start, end);
  assert.match(block, /if \(closingTerminalIdsRef\.current\.has\(id\)\) return;/u);
  assert.match(block, /closingTerminalIdsRef\.current\.add\(id\);/u);
  assert.match(block, /finally \{[\s\S]*?closingTerminalIdsRef\.current\.delete\(id\);/u);
});

test('Close Other Terminals also marks doomed ids as closing', () => {
  const start = terminal.indexOf('const closeOtherTerminals = React.useCallback(');
  const end = terminal.indexOf('    [rememberClosed],', start);
  const block = terminal.slice(start, end);
  assert.match(block, /closingTerminalIdsRef\.current\.add\(terminal\.id\);/u);
  assert.match(block, /closingTerminalIdsRef\.current\.delete\(terminal\.id\)/u);
});
