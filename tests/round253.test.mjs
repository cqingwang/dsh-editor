import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the terminal screen menu exposes split-right and move-to-editor', () => {
  const start = source.indexOf('function terminalMenuModel(');
  const block = source.slice(start, source.indexOf('function terminalMoveTarget(', start));
  assert.match(block, /onSplitRight/);
  assert.match(block, /id: 'splitRight'/);
  assert.match(block, /id: 'moveToEditor'/);
  assert.match(source, /onSplitRight: splitId === null \? \(\) => void toggleSplit\(\) : null/);
  assert.match(source, /onMoveToEditor: \(\) => moveTerminalToEditor\(terminal\)/);
});
