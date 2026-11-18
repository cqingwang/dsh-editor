import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('reopening a closed terminal restores its saved working directory', () => {
  const start = client.indexOf('const reopenClosed = React.useCallback(');
  assert.notEqual(start, -1);
  const end = client.indexOf('[createTerminal]', start);
  const block = client.slice(start, end);
  assert.match(block, /createTerminal\(exists \? entry\.shell : undefined, entry\.cwd\);/u);
});
