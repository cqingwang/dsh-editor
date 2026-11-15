import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('Changes directory rows participate in the roving keyboard tree', () => {
  const start = commit.indexOf("key: `${group.id}:${row.path}`");
  const row = commit.slice(start, commit.indexOf('React.createElement(', start + 500));
  assert.match(row, /'data-dsh-change-directory': row\.path/);
  assert.match(row, /tabIndex: -1/);
  assert.match(row, /event\.key === 'ArrowRight'/);
  assert.match(row, /event\.key === 'ArrowLeft'/);
  assert.match(row, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
});

test('Changes keyboard navigation includes directories without poisoning file typeahead', () => {
  const start = source.indexOf('const onChangesKeyDown = React.useCallback(');
  const handler = source.slice(start, source.indexOf('const onChangesKeyUp = React.useCallback(', start));
  assert.match(handler, /\[data-dsh-change-group\], \[data-dsh-change-path\], \[data-dsh-change-directory\]/);
  assert.match(handler, /row\.getAttribute\('data-dsh-change-directory'\)/);
  assert.match(handler, /chooseGroup\(null\)/);
  assert.match(handler, /filter\(\(row\) => row\.hasAttribute\('data-dsh-change-path'\)\)/);
});

test('programmatic directory focus has a visible IDEA-style focus ring', () => {
  assert.match(source, /'\[data-dsh-change-directory\]:focus-visible \{'/);
  assert.match(source, /'  outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;'/);
});
