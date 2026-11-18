import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('clicking the empty area below the rows keeps the IDEA tree selection', () => {
  /* The current IDEA Project tree retains its selected row when the background is
     clicked. The background remains a drop target, but it is not a clear surface. */
  const start = source.indexOf('ref: treeRef,');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 2600);
  assert.doesNotMatch(block, /onClearSelection\?\.\(\);/);
  assert.doesNotMatch(block, /onClick:[\s\S]{0,240}?onClearSelection/);
  assert.match(block, /onDragOver:/);
});

test('the obsolete clear-selection callback is no longer declared or passed', () => {
  assert.doesNotMatch(source, /const clearTreeSelection = React\.useCallback\(/);
  assert.doesNotMatch(source, /onClearSelection: clearTreeSelection,/);
});
