import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const row = readFileSync(join(root, 'src/client/components/commit/CommitGraphRow.tsx'), 'utf8');
const log = readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

test('graph rows expose the shared commit menu on right click', () => {
  assert.match(row, /onContextMenu=\{\(event\) => \{/);
  assert.match(row, /event\.preventDefault\(\)/);
  assert.match(row, /event\.stopPropagation\(\)/);
  assert.match(row, /onShow\?\.\(entry\.hash\)/);
  assert.match(row, /onContextMenu\?\.\(\{\s+commit: entry,\s+selectionHashes: contextSelection,\s+x: event\.clientX,\s+y: event\.clientY,/);
});

test('right click synchronises graph cursor before opening the menu', () => {
  assert.match(log, /onContextMenu=\{\(payload\) => \{/);
  assert.match(log, /setGraphCursor\(payload\.commit\.hash\)/);
  assert.match(log, /setGraphHover\(null\)/);
  assert.match(log, /onContextMenu\?\.\(payload\)/);
});
