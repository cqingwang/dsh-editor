import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('clicking Project tree background keeps the current IDEA selection', () => {
  assert.doesNotMatch(source, /onClearSelection\?\.\(\);/);
  assert.doesNotMatch(source, /onClearSelection: clearTreeSelection/);
  assert.doesNotMatch(source, /\n      onClearSelection,/);
});

test('the tree background remains available for workspace-root drop', () => {
  const start = source.indexOf("role: 'tree',\n            'aria-label': t('editor.project')");
  const end = source.indexOf("/* Keyboard navigation over the visible flattened rows. */", start);
  assert.notEqual(start, -1, 'Project tree shell is missing');
  assert.notEqual(end, -1, 'Project tree shell end is missing');
  const tree = source.slice(start, end);
  assert.match(tree, /onDragOver:/);
  assert.match(tree, /dataTransfer\.dropEffect = 'move'/);
});
