import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Enter in speed search opens the hit, not just highlights it', () => {
  /* IDEA's speed search is a navigation tool: typing then Enter must take you to
     the file. Selecting the row and stopping there leaves the editor unchanged. */
  const start = source.indexOf('const hit = hits.find');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1100);
  /* Round 134 routes the decision through `revealInTree`. */
  assert.match(block, /revealInTree\(\{ \.\.\.hit, open: expanded\.has\(hit\.path\) \}\)/);
  assert.match(block, /action === 'open'\) onOpen\(hit\.path\)/);
  /* The search box closes so the opened file gets the keyboard. */
  assert.match(block, /setSearchOpen\(false\)/);
});
