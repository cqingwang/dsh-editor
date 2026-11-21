import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('Terminal stays busy until every concurrent operation releases its claim', () => {
  let busy = false;
  const scope = {
    busyOperationCountRef: { current: 0 },
    setBusy: (value) => {
      busy = value;
    },
  };
  scope.beginBusyOperation = loadTypeScriptCallback(panelSource, 'beginBusyOperation', scope);
  scope.endBusyOperation = loadTypeScriptCallback(panelSource, 'endBusyOperation', scope);

  scope.beginBusyOperation();
  scope.beginBusyOperation();
  assert.equal(scope.busyOperationCountRef.current, 2);
  assert.equal(busy, true);

  scope.endBusyOperation();
  assert.equal(scope.busyOperationCountRef.current, 1);
  assert.equal(busy, true);

  scope.endBusyOperation();
  assert.equal(scope.busyOperationCountRef.current, 0);
  assert.equal(busy, false);
});

test('Terminal create and shell menu share the busy operation counter', () => {
  const createStart = panelSource.indexOf('const createTerminal = React.useCallback(');
  const createEnd = panelSource.indexOf('const cycleTerminalColor = React.useCallback(', createStart);
  const createBlock = panelSource.slice(createStart, createEnd);
  assert.match(createBlock, /beginBusyOperation\(\)/u);
  assert.match(createBlock, /endBusyOperation\(\)/u);

  const menuStart = panelSource.indexOf('const openShellMenu = React.useCallback(');
  const menuEnd = panelSource.indexOf('const commitRename = React.useCallback(', menuStart);
  const menuBlock = panelSource.slice(menuStart, menuEnd);
  assert.match(menuBlock, /beginBusyOperation\(\)/u);
  assert.match(menuBlock, /endBusyOperation\(\)/u);
});
