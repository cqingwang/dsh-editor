import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function commitFileRow() {
  const start = source.indexOf("'data-dsh-change-path': change.path");
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('onContextMenu:', start));
}

test('double-clicking a commit checkbox cannot open the file diff', () => {
  const row = commitFileRow();
  assert.match(
    row,
    /onDoubleClick: \(event\) => \{\s+if \(event\.target instanceof Element && event\.target\.closest\('input, button, a, \[role="checkbox"\]'\) !== null\) return;\s+onSelectDiff\?\.\(\{ path: change\.path, staged: group\.id === 'staged' \}\);/,
  );
});

test('the row still selects on click and opens diff only from the guarded double-click', () => {
  const row = commitFileRow();
  assert.match(row, /onClick: \(event\) => onSelectChange\?\.\(\{/);
  assert.match(row, /onDoubleClick: \(event\) => \{/);
  assert.match(row, /onSelectDiff\?\.\(\{ path: change\.path, staged: group\.id === 'staged' \}\)/);
});
