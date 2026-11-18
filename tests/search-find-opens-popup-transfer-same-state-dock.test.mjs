import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findToolDockSource = await readFile(
  new URL('../src/client/components/search/FindToolDock.tsx', import.meta.url),
  'utf8',
);
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

test('Find opens as a popup and can transfer the same state to a dock', () => {
  const opener = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('/** Single shortcut body shared'),
  );
  assert.match(opener, /surface: surface === 'dock' \? 'dock' : 'popup'/);
  assert.match(source, /const openFindToolInDock = React\.useCallback/);
  const transfer = source.slice(
    source.indexOf('const openFindToolInDock = React.useCallback'),
    source.indexOf('/** Single shortcut body shared'),
  );
  assert.match(transfer, /setTerminalOpen\(false\)/);
  assert.match(transfer, /surface: 'dock'/);
  assert.match(transfer, /data-dsh-find-tool-window\] input\[role="combobox"\]/);
});

test('Find renders one shared result model in a resizable bottom dock', () => {
  assert.match(source, /function clampFindDockHeight/);
  assert.match(source, /dsh-editor\.find\.height/);
  assert.match(findToolDockSource, /data-dsh-find-tool-dock=''/);
  assert.match(source, /findTool\?\.surface === 'dock'/);
  assert.match(source, /React\.createElement\(FindToolDock, \{/);
  assert.match(source, /onCommit: \(final\) => writeStoredNumber\('dsh-editor\.find\.height', final\)/);
  assert.match(findToolDockSource, /style=\{\{ \.\.\.styles\.dock, height \}\}/);
  assert.match(findToolDockSource, /onCommit\(latest\)/);
});

test('Open in Find Window follows query presence and warns above the shared limit', () => {
  assert.match(findTool, /if \(!floating \|\| !hasFindToolContentQuery\(query\)\) return/);
  assert.match(findTool, /searchEverywhereRequiresResultConfirmation\(scopedFileResults, scopedMatches\)/);
  assert.match(findTool, /window\.confirm\(\s+t\('editor\.searchTooManyResults'/u);
  assert.match(findTool, /onClick: requestOpenInFindWindow/);
  assert.match(findTool, /disabled: !hasFindToolContentQuery\(query\)/);
});

test('The dock reuses FindToolWindow without popup-only outside-click closing', () => {
  assert.match(findTool, /floating = true,/);
  assert.match(findTool, /if \(!floating \|\| pinned\) return undefined/);
  assert.match(findTool, /onOpenInFindWindow/);
  assert.match(source, /floating: findTool\.surface !== 'dock'/);
});

test('Opening Find from the shortcut returns an existing docked result to the popup', () => {
  const shortcut = source.slice(
    source.indexOf('const openFindInFilesFromShortcut = React.useCallback'),
    source.indexOf('/**\n       * Hide the persistent Find tool'),
  );
  assert.match(shortcut, /surface === 'dock'/);
  assert.match(shortcut, /current\.surface === 'dock' \? 'popup'/);
});

test('Explicit Find tool-window actions open the dock instead of the popup', () => {
  assert.match(source, /const openFindTool = React\.useCallback\(\(query = '', mode = 'find', initial = null, focusTarget = 'query', surface = 'popup'\)/);
  assert.match(source, /surface: surface === 'dock' \? 'dock' : 'popup'/);
  assert.match(source, /pinShowUsages[\s\S]*?'query', 'dock'/);
  assert.match(source, /id: 'findToolWindow'[\s\S]*?openFindTool\('', 'find', null, 'query', 'dock'\)/);
  assert.match(source, /onOpenInFindToolWindow: \(initial\) => openFindTool\([\s\S]*?'query',\s*'dock'/);
});
