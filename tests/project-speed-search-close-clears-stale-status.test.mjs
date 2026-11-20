import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('closing Project speed search clears every query-owned status immediately', () => {
  const helper = panelSource.slice(
    panelSource.indexOf('const clearTreeSearchState = React.useCallback((): void => {'),
    panelSource.indexOf('const closeTreeSearch = React.useCallback(() => {'),
  );
  for (const setter of [
    "setSearch('')",
    'setSearchEntries(null)',
    'setSearchPending(false)',
    'setSearchError(null)',
    'setSearchTruncated(false)',
  ]) {
    assert.ok(helper.includes(setter), `${setter} is missing from the close path`);
  }
});

test('Esc, the close button and Enter share the same state cleanup', () => {
  const close = panelSource.slice(
    panelSource.indexOf('const closeTreeSearch = React.useCallback(() => {'),
    panelSource.indexOf(
      'const openSelectedContextMenuFromKeyboard',
      panelSource.indexOf('const closeTreeSearch = React.useCallback(() => {'),
    ),
  );
  assert.match(close, /clearTreeSearchState\(\);/u);

  const enter = panelSource.slice(
    panelSource.indexOf("} else if (event.key === 'Enter') {"),
    panelSource.indexOf(
      'window.setTimeout(() => treeRef.current?.focus(), 0);',
      panelSource.indexOf("} else if (event.key === 'Enter') {"),
    ),
  );
  assert.match(enter, /clearTreeSearchState\(\);/u);
});
