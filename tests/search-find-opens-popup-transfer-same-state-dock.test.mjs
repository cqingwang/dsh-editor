import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  terminalSource +
  '\n' +
  commitSource;
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
  assert.match(source, /<FindToolDock/);
  assert.match(source, /onCommit=\{\(final\) => writeStoredNumber\('dsh-editor\.find\.height', final\)\}/);
  assert.match(findToolDockSource, /style=\{\{ \.\.\.styles\.dock, height \}\}/);
  assert.match(findToolDockSource, /<DockResizeHandle/);
  assert.match(findToolDockSource, /onCommit=\{onCommit\}/);
});

test('Open in Find Window follows query presence and warns above the shared limit', () => {
  assert.match(findTool, /if \(!floating \|\| !hasFindToolContentQuery\(query\)\) return/);
  assert.match(findTool, /searchEverywhereRequiresResultConfirmation\(scopedFileResults, scopedMatches\)/);
  assert.match(findTool, /window\.confirm\(\s+t\('editor\.searchTooManyResults'/u);
  assert.match(findTool, /onClick=\{requestOpenInFindWindow\}/);
  assert.match(findTool, /disabled=\{!hasFindToolContentQuery\(query\)\}/);
});

test('The dock reuses FindToolWindow without popup-only outside-click closing', () => {
  assert.match(findTool, /floating = true,/);
  assert.match(findTool, /if \(!floating \|\| pinned\) return undefined/);
  assert.match(findTool, /onOpenInFindWindow/);
  assert.match(source, /floating=\{findTool\.surface !== 'dock'\}/);
});

test('surface remount preserves the active result while real grouping changes still reset it', () => {
  assert.match(findTool, /const resultGroupingIdentity = `\$\{scopeMode\}:\$\{scopePreset\}:\$\{findGroupBy\}`/);
  assert.match(findTool, /const previousResultGroupingRef = React\.useRef<string \| null>\(null\)/);
  assert.match(
    findTool,
    /const previousIdentity = previousResultGroupingRef\.current;\s+previousResultGroupingRef\.current = resultGroupingIdentity;\s+if \(previousIdentity === null \|\| previousIdentity === resultGroupingIdentity\) return;\s+onCollapsedFilesChange\?\.\(\[\]\);\s+if \(state\.index !== 0\) onMove\(0, 0\)/u,
  );
});

test('surface remount preserves collapsed Find file groups', () => {
  assert.match(source, /collapsedFiles\?: string\[\]/u);
  assert.match(source, /handoffHandledRevision\?: number/u);
  assert.match(source, /collapsedFiles: \[\],/u);
  assert.match(source, /onCollapsedFilesChange=\{\(collapsedFiles\) =>/u);
  assert.match(source, /onHandoffHandled=\{\(handoffHandledRevision\) =>/u);
  assert.match(findTool, /Array\.isArray\(state\.collapsedFiles\)/u);
});

test('Opening Find from the shortcut returns an existing docked result to the popup', () => {
  const shortcut = source.slice(
    source.indexOf('const openFindInFilesFromShortcut ='),
    source.indexOf('const closeFindToolWindow', source.indexOf('const openFindInFilesFromShortcut =')),
  );
  assert.match(shortcut, /surface === 'dock'/);
  assert.match(shortcut, /current\.surface === 'dock' \? 'popup'/);
  assert.match(shortcut, /mode: current\.surface === 'dock' && hasSelectionQuery === false \? current\.mode : 'find'/u);
});

test('Explicit Find tool-window actions open the dock instead of the popup', () => {
  let state = null;
  const openFindTool = loadTypeScriptCallback(workspaceSource, 'openFindTool', {
    findToolContentQuery: (query) => String(query ?? '').trim(),
    completeFindFiles: (value) =>
      Array.isArray(value)
        ? value.filter((item) => typeof item?.path === 'string').map((item) => ({ path: item.path }))
        : [],
    completeFindMatches: (value) =>
      Array.isArray(value)
        ? value.filter(
            (item) =>
              typeof item?.path === 'string' && typeof item.line === 'number' && typeof item.column === 'number',
          )
        : [],
    normalizeSearchOptions: (value) => value ?? {},
    readSearchOptions: () => ({}),
    readFindScope: () => ({ mode: 'project', preset: 'projectFiles', directory: '' }),
    readFindDirectoryRecursive: () => true,
    rootRef: { current: '' },
    findDockState: {
      claimFindDockSlot: () => {},
    },
    setTerminalOpen: () => {},
    setSearchEverywhere: () => {},
    setFindTool: (value) => {
      state = value;
    },
    findToolHandoffSequenceRef: { current: 0 },
    findToolDraftRef: { current: { query: '', replace: '' } },
    findToolReopenDraft: (_draft, query) => ({ query, replace: '' }),
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });
  openFindTool('', 'find', null, 'query', 'dock');
  assert.equal(state.surface, 'dock');

  const forwarded = [];
  const pinShowUsages = loadTypeScriptCallback(workspaceSource, 'pinShowUsages', {
    showUsages: {
      query: 'needle',
      matches: [{ path: 'a.ts', line: 1, column: 1 }],
      truncated: false,
    },
    closeShowUsages: () => {},
    openFindTool: (...args) => forwarded.push(args),
  });
  pinShowUsages();
  assert.deepEqual(forwarded[0].slice(0, 2), ['needle', 'find']);
  assert.equal(forwarded[0].at(-1), 'dock');
});
