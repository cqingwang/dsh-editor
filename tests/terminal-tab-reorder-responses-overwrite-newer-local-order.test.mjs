import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));

test('terminal tab reorder responses cannot overwrite a newer local order', () => {
  assert.match(terminal, /const terminalReorderRequestRef = React\.useRef\(0\);/u);
  const start = terminal.indexOf('const moveTab = React.useCallback(');
  const end = terminal.indexOf('        [],', start);
  const block = terminal.slice(start, end);
  assert.match(block, /const requestId = \+\+terminalReorderRequestRef\.current;/u);
  assert.match(block, /if \(terminalReorderRequestRef\.current !== requestId\) return;/u);
  assert.match(block, /setTerminals\(value\.terminals\)/u);
});
