import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('after Enter in speed search the tree takes the keyboard back', () => {
  /* IDEA's speed search is a navigation tool: once the hit is opened the tree owns
     the arrow keys again. Leaving focus in the (now closed) input strands it. */
  const start = source.indexOf('const hit = hits.find');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1300);
  assert.match(block, /treeRef\.current\?\.focus\(\)/);
  /* Focus must come AFTER the search box closes, or it lands on a detached node. */
  const focusAt = block.indexOf('treeRef.current?.focus()');
  const closeAt = block.indexOf('setSearchOpen(false)');
  assert.ok(closeAt !== -1 && focusAt > closeAt, 'focus must follow the close');
});
