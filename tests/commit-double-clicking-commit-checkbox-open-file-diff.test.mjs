import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function commitFileRow() {
  const start = source.indexOf('data-dsh-change-path={change.path}');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('onContextMenu:', start));
}

test('double-clicking a commit checkbox cannot open the file diff', () => {
  const row = commitFileRow();
  assert.match(
    row,
    /onDoubleClick=\{\(event\) => \{\s+if \(\s+event\.target instanceof Element &&\s+event\.target\.closest\('input, button, a, \[role="checkbox"\]'\) !== null\s+\)\s+return;\s+onSelectDiff\?\.\(\{\s+path: change\.path,\s+staged: group\.id === 'staged',\s+\}\);/u,
  );
});

test('the row still selects on click and opens diff only from the guarded double-click', () => {
  const row = commitFileRow();
  assert.match(row, /onClick=\{\(event\) =>\s+onSelectChange\?\.\(\{/u);
  assert.match(row, /onDoubleClick=\{\(event\) => \{/);
  assert.match(row, /onSelectDiff\?\.\(\{\s+path: change\.path,\s+staged: group\.id === 'staged',\s+\}\)/u);
});
