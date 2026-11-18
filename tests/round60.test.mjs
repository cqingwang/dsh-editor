import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('a directory row in the change tree has its own context menu', () => {
  const start = source.indexOf("if (row.kind === 'directory') {");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3200);
  /* The directory row must open a menu that acts on the whole subtree. */
  assert.match(block, /onContextMenu: \(event\) => \{/);
  assert.match(block, /onContextMenu\?\.\(\{ directory: row\.path, changes: row\.changes \?\? \[\], group: group\.id, x: event\.clientX, y: event\.clientY \}\)/);
});

test('the directory menu stages, unstages and rolls back the subtree', () => {
  const start = source.indexOf('const buildChangeDirMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const buildChangeMenu', start));
  assert.match(block, /t\('editor\.stageThisDirectory'\)/);
  assert.match(block, /t\('editor\.unstageThisDirectory'\)/);
  assert.match(block, /t\('editor\.rollbackDirectory'\)/);
  /* The actions receive the collected paths, not the directory path itself. */
  assert.match(block, /run: \(\) => void restage\(paths, false\)/);
  assert.match(block, /run: \(\) => void restage\(paths, true\)/);
  assert.match(block, /run: \(\) => void rollback\(paths\)/);
});

test('the directory menu is wired into the panel', () => {
  assert.match(source, /setMenu\(payload\.directory === undefined \? buildChangeMenu\(payload\) : buildChangeDirMenu\(payload\)\)/);
  assert.match(source, /const buildChangeDirMenu = React.useCallback\(/);
});
