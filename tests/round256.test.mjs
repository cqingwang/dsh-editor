import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the screen split action uses the dock split operation, not a no-op tab rebind', () => {
  assert.match(source, /onSplitRight: splitId === null \? \(\) => void toggleSplit\(\) : null/);
  assert.doesNotMatch(source, /onSplitRight: terminal\.id === activeId \? null/);
});
