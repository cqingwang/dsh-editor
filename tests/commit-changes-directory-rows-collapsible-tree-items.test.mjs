import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('Changes directory rows are collapsible tree items', () => {
  const start = commit.indexOf("key: `${group.id}:${row.path}`");
  assert.notEqual(start, -1, 'directory row should exist');
  const row = commit.slice(start, commit.indexOf("React.createElement(\n                      'span',\n                      { style: styles.commitChevron }", start));
  assert.match(row, /role: 'treeitem'/);
  assert.match(row, /'aria-expanded': row\.open/);
  assert.match(row, /onContextMenu: \(event\) => \{/);
});

test('Changes file rows retain selected state as tree items', () => {
  const start = commit.indexOf("key: `${group.id}:${change.path}`");
  assert.notEqual(start, -1, 'file row should exist');
  const row = commit.slice(start, commit.indexOf("React.createElement('span', { style: styles.commitChevron })", start));
  assert.match(row, /role: 'treeitem'/);
  assert.match(row, /'aria-selected': selectedForChange/);
  assert.match(row, /tabIndex: selectedForChange \? 0 : -1/);
});
