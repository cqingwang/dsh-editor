import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the Terminal dock restores its last height per browser', () => {
  const block = source.slice(
    source.indexOf('const [terminalHeight, setTerminalHeight]'),
    source.indexOf('const [dockDragging, setDockDragging]'),
  );
  assert.match(block, /readStoredNumber\('dsh-editor\.terminal\.height', 220\)/);
  assert.match(source, /writeStoredNumber\('dsh-editor\.terminal\.height',/);
});

test('the dock height is clamped before it is stored', () => {
  const block = source.slice(
    source.indexOf('const [terminalHeight, setTerminalHeight]'),
    source.indexOf('const [dockDragging, setDockDragging]'),
  );
  assert.match(block, /clampTerminalHeight/);
  assert.match(source, /const clampTerminalHeight = /);
  assert.match(source, /TERMINAL_DOCK_MIN_HEIGHT = 96/);
  assert.match(source, /TERMINAL_DOCK_MAX_HEIGHT = 640/);
  assert.match(source, /Math\.max\(TERMINAL_DOCK_MIN_HEIGHT, Math\.min\(TERMINAL_DOCK_MAX_HEIGHT,/);
});
