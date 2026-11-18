import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('TerminalScreen is a reusable TSX terminal view', async () => {
  const screen = await read('src/client/components/terminal/TerminalScreen.tsx');

  assert.match(screen, /export interface TerminalScreenProps/u);
  assert.match(screen, /loadXterm\(\)/u);
  assert.match(screen, /data-dsh-terminal-pane=''/u);
  assert.match(screen, /terminalMatches\(emulator, find\.query\)/u);
  assert.doesNotMatch(screen, /React\.createElement/u);
});
