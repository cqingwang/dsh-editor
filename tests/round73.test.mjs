import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('dragging onto the tree background means "move to the workspace root"', () => {
  /* Without this, a drop that misses a row does nothing at all — the most common
     way a drag "fails" in IDEA's Project view is landing on empty space. */
  const start = source.indexOf('ref: treeRef,');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 2200);
  assert.match(block, /onDragOver: \(event\) => \{/);
  assert.match(block, /event\.preventDefault\(\);/);
  assert.match(block, /onDrop: \(event\) => \{/);
  assert.match(block, /if \(overRow\) return;/);
  assert.match(block, /onDrop\(sources, ''\)/);
});

test('the background drop ignores a drag that did not come from the tree', () => {
  const start = source.indexOf('ref: treeRef,');
  const block = source.slice(start, start + 2200);
  /* Only our own rows set `text/plain` with newline-separated paths; a text drag
     from the terminal or the chat must not move files. */
  assert.match(block, /getData\('text\/plain'\)/);
  assert.match(block, /sources\.length === 0/);
});

test('the drop target highlights while a draggable payload is over it', () => {
  const start = source.indexOf('ref: treeRef,');
  const block = source.slice(start, start + 1800);
  assert.match(block, /setRootDropActive/);
  assert.match(block, /styles\.treeRootDrop/);
});
