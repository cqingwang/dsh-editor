import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/terminal-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('the terminal find bar reclaims focus after closing the context menu', () => {
  const panel = source.slice(source.indexOf('function TerminalPanel('), source.indexOf('function terminalTheme('));
  assert.match(panel, /const findInputRef = React\.useRef\(null\);/);
  assert.match(panel, /findInputRef\.current\?\.focus\(\)/);
  assert.match(panel, /ref: findInputRef/);
  assert.match(panel, /\}, \[find === null\]\);/);
});
