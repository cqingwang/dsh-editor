import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the terminal tab menu can reveal its shell directory', () => {
  /* IDEA's terminal tab menu has "Open in ..." for the shell's cwd; without it the
     only way to find the directory is to read the path off the tab title. */
  const start = source.indexOf('function terminalTabMenu(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('async function pasteIntoTerminal(', start));
  assert.match(block, /t\('editor\.revealInFinder'\)/);
  assert.match(block, /run: \(\) => actions\.revealCwd\?\.\(\)/);
  /* It sits next to "copy path": both act on the same directory. */
  assert.match(block, /id: 'copyPath'/);
});

test('the menu action calls the host reveal endpoint with the terminal cwd', () => {
  const start = source.indexOf('terminalTabMenu(t, terminal, {');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('colors[terminal.id] === undefined', start));
  /* Round 122 prefers the OSC 7 directory with `terminal.cwd` as fallback. */
  assert.match(block, /revealCwd: \(\) => void revealTerminalDirectory\(terminalCwdRef\.current\.get\(terminal\.id\) \?\? terminal\.cwd\)/);
  assert.match(source, /const revealTerminalDirectory = React\.useCallback\(/);
});

test('a cwd outside the workspace is opened by absolute path, and failures are reported', () => {
  /* Round 126 replaced the old "fall back to the workspace root" behaviour: a shell
     in /tmp should open /tmp. What must survive is that a failure still says so. */
  const start = source.indexOf('const revealTerminalDirectory = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1600);
  assert.match(block, /op: 'reveal'/);
  assert.match(block, /absolute: true/);
  assert.match(block, /catch/);
  assert.match(block, /setClipboardNotice|setError/);
});
