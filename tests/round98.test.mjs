import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('⌘K clears the focused pane, never the other one', () => {
  const start = source.indexOf("event.key.toLowerCase() === 'k'");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 500);
  assert.match(block, /focusedPaneRef\.current === 'right' \? splitEmulatorRef\.current : emulatorRef\.current/);
  assert.match(block, /emulator\?\.clear\(\)/);
});

test('⌘K does not kill the shell, only the screen', () => {
  const start = source.indexOf("event.key.toLowerCase() === 'k'");
  const block = source.slice(start, start + 500);
  /* `clear()` keeps the scrollback; the buffer-dropping variant has its own entry. */
  assert.doesNotMatch(block, /dispose|kill|reset/);
});
