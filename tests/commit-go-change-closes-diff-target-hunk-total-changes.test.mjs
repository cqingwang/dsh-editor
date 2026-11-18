import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('Go To Change closes when the diff target or hunk total changes', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[hunkMenu, setHunkMenu\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(diff, /React\.useEffect\(\(\) => \{\n\s+setHunkMenu\(null\);\n\s+\}, \[target, hunks\.total\]\);/);
  assert.match(diff, /hunkMenu === null \? null : \(\s*<ContextMenu/u);
});

test('jumpToDiffHunk always reads the CURRENT diff hunks', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const jumpToDiffHunk = React.useCallback');
  const end = diff.indexOf('const openHunkMenu = React.useCallback', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const jump = diff.slice(start, end);
  assert.match(jump, /const changes = diffRef\.current\?\.getLineChanges\?\.\(\) \?\? \[\]/);
  assert.match(jump, /diffRef\.current\?\.getModifiedEditor\?\.\(\)/);
});
