import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('clicking the empty area below the rows clears the selection', () => {
  /* IDEA drops the selection when you click the tree's background; without it the
     old row stays highlighted and every context action still targets it. */
  const start = source.indexOf('ref: treeRef,');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 2600);
  assert.match(block, /onClick: \(event\) => \{/);
  assert.match(block, /closest\('\.dsh-editor-tree-row'\)/);
  assert.match(block, /onClearSelection\?\.\(\);/);
});

test('the clear callback resets the anchor so Shift+click starts over', () => {
  assert.match(source, /const clearTreeSelection = React\.useCallback\(/);
  const start = source.indexOf('const clearTreeSelection = React.useCallback(');
  const block = source.slice(start, start + 500);
  assert.match(block, /setSelection\(new Set\(\)\)/);
  assert.match(block, /setSelectedPathRaw\(null\)/);
  assert.match(block, /selectionAnchor\.current = null/);
});

test('the clear callback is passed into the panel, not captured from its parent', () => {
  /* `ProjectPanel` is a sibling component: a bare `clearTreeSelection()` there is a
     ReferenceError at runtime (found exactly that way), so the handler must arrive
     as a prop. */
  assert.match(source, /onClearSelection,\n      showHidden,/);
  assert.match(source, /onClearSelection: clearTreeSelection,/);
});

test('a click on a row does not bubble into a clear', () => {
  const start = source.indexOf('ref: treeRef,');
  const block = source.slice(start, start + 2600);
  /* The row handler runs first and the container checks the target, so a row click
     must not reach the clear branch. */
  assert.match(block, /if \(target !== null\) return;/);
});
