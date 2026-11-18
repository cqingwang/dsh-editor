import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('flat Log rows return focus to the listbox after a mouse context menu', () => {
  const rowStart = log.indexOf('<CommitLogFlatRow');
  assert.notEqual(rowStart, -1);
  const row = log.slice(rowStart, log.indexOf('/>', rowStart));
  assert.match(
    row,
    /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+listRef\.current\?\.focus\?\.\(\{\s+preventScroll: true,\s+\}\);/u,
  );
});

test('Graph context menus focus the same Log listbox before opening', () => {
  assert.match(
    log,
    /onContextMenu=\{\(payload\) => \{\s+listRef\.current\?\.focus\?\.\(\{\s+preventScroll: true,\s+\}\);\s+setGraphCursor\(payload\.commit\.hash\);/u,
  );
});
