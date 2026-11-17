import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const terminalStart = client.indexOf('function TerminalPanel(');
const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));

test('reopening a closed terminal restores its saved working directory', () => {
  const start = terminal.indexOf('const reopenClosed = React.useCallback(async (entry) => {');
  const end = terminal.indexOf('      }, [createTerminal]);', start);
  const block = terminal.slice(start, end);
  assert.match(block, /await createTerminal\(exists \? entry\.shell : undefined, entry\.cwd\);/u);
});
