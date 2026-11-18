import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');

test('the terminal find bar reclaims focus after closing the context menu', () => {
  assert.match(source, /const findInputRef = React\.useRef\(null\);/);
  assert.match(source, /findInputRef\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{findInputRef\}/);
  assert.match(source, /\}, \[find === null\]\);/);
});
