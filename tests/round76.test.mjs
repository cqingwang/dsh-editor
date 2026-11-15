import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('double-clicking a tree row OPENS it and does not start a rename', () => {
  /* Round 153: IDEA's slow double-click starts an inline rename, but that field
     also commits on blur — so double-clicking a few rows renamed whichever one was
     last, and for a directory it produced
     `EINVAL … rename 'assets' -> 'assets/assets'`. A double-click now only opens;
     rename comes from the context menu or F2. */
  const start = source.indexOf('ref: treeRef,');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('onContextMenu:', start));
  assert.match(block, /onDoubleClick: \(event\) => \{/);
  /* The second click still must not toggle a directory back closed. */
  assert.match(block, /event\.stopPropagation\(\);/);
  assert.doesNotMatch(block, /onStartRename/);
});

test('rename is reached from the context menu and the keyboard only', () => {
  /* No rename starter is threaded into the tree any more. */
  assert.doesNotMatch(source, /onStartRename/);
  assert.doesNotMatch(source, /const startRenameRow = React\.useCallback\(/);
  /* The context menu's Rename item is the mouse path. */
  assert.match(source, /id: 'rename',/);
  assert.match(source, /setRenameState\(\{ path: row\.path, value: basename\(row\.path\) \}\)/);
  /* F2 is the keyboard path. */
  const f2 = source.slice(source.indexOf("case 'F2':"));
  assert.match(f2.slice(0, 400), /setRenameState\(\{ path: current\.path, value: basename\(current\.path\) \}\)/);
});
