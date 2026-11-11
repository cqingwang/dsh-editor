import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('⌥←/→ walks the focused pane\'s tabs, not the left pane\'s list', () => {
  const start = source.indexOf('if (event.altKey && !meta && (event.key === \'ArrowLeft\' || event.key === \'ArrowRight\')) {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1500);
  assert.match(block, /focusedPaneRef\.current === 'right'/);
  assert.match(block, /setSplitId\(next\.id\)/);
});

test('the right pane cycles from its own tab, and never lands on the left one', () => {
  const start = source.indexOf('if (event.altKey && !meta && (event.key === \'ArrowLeft\' || event.key === \'ArrowRight\')) {');
  const block = source.slice(start, start + 1600);
  /* Starting index comes from the pane's binding, so ⌥→ in the right pane advances
     from the terminal it is showing. */
  assert.match(block, /onRight \? splitIdRef\.current : activeRef\.current/);
});
