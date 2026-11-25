import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractUseEffectExpressionContaining, loadTypeScriptExpression } from './ts-source.mjs';

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
  assert.match(panelSource, /if \(keyAction === 'close'\) \{\s+closeTreeSearch\(\);/u);
  assert.match(panelSource, /clearTreeSearchState\(\);\s+setSearchOpen\(false\);/u);
});

test('switching Project views closes speed search without restoring the old view selection', () => {
  const effectSource = extractUseEffectExpressionContaining(
    panelSource,
    'previousProjectViewRef.current === projectView',
  );
  const calls = [];
  const previousProjectViewRef = { current: 'openFiles' };
  const effect = loadTypeScriptExpression(panelSource, effectSource, {
    clearTreeSearchState: () => calls.push('clear'),
    directSpeedSearchRef: { current: 'app' },
    previousProjectViewRef,
    projectView: 'changedFiles',
    searchOpen: true,
    searchReturnSelectionRef: { current: { selection: new Set(['old']), primary: 'old' } },
    setSearchOpen: (value) => calls.push(['open', value]),
    treeRef: { current: { focus: () => calls.push('focus') } },
    window: { setTimeout: (callback) => callback() },
  });
  effect();
  assert.deepEqual(calls, ['clear', ['open', false], 'focus']);
  assert.equal(previousProjectViewRef.current, 'changedFiles');
  assert.equal(effectSource.includes('onApplySelection'), false);
});
