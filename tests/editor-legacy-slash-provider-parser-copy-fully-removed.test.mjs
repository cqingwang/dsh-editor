import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('legacy slash/provider parser and copy are fully removed', () => {
  for (const helper of [
    'searchEverywhereCommandQuery',
    'searchEverywhereProviderCommand',
    'searchEverywhereProviderCompletion',
    'searchEverywhereProviderCommandSuggestions',
    'searchEverywhereContentQuery',
  ]) {
    assert.doesNotMatch(source, new RegExp(`function ${helper}\\(`), helper);
  }
  for (const key of [
    'providerCommandAllHint',
    'providerCommandFilesHint',
    'providerCommandTextHint',
    'providerCommandActionsHint',
  ]) {
    assert.doesNotMatch(source, new RegExp(`${key}: '`), key);
  }
});

test('workspace changes still reset transient search surfaces', () => {
  const effect = source.slice(
    source.indexOf('const previousWorkspaceSearchRootRef = React.useRef(root);'),
    source.indexOf(
      "setRecentReplacements(root === '' ? [] : readReplaceHistory(root));",
      source.indexOf('searchEverywhereFilesRequestRef.current += 1;'),
    ),
  );
  assert.ok(effect.length > 0);
  assert.doesNotMatch(effect, /doubleShift/);
  assert.match(effect, /workspaceSearchSurfacesShouldReset\(previousWorkspaceRoot, root\)/);
  assert.match(effect, /cancelWorkspaceSearchRequests\(\)/);
  assert.match(effect, /setSearchEverywhere\(null\)/);
  assert.match(effect, /setShowUsages\(null\)/);
  assert.match(effect, /setFindTool\(null\)/);
});

test('stale text-search responses cannot overwrite a newer query', () => {
  const requestMarker = source.indexOf('const requestId = ++searchTextRequestRef.current');
  const start = source.lastIndexOf('React.useEffect(() => {', requestMarker);
  const end = source.indexOf('/**\n       * Move a Search Everywhere result set', requestMarker);
  const effect = source.slice(start, end);
  assert.ok((effect.match(/searchTextRequestRef\.current !== requestId/g) ?? []).length >= 2);
  assert.match(effect, /const requestId = \+\+searchTextRequestRef\.current/);
});

test('narrow Search Everywhere keeps tabs and toolbar non-shrinking', () => {
  assert.match(source, /width: 'min\(820px, 94vw\)'/);
  const tabsStart = source.indexOf('searchEverywhereTabs: {');
  const tabsEnd = source.indexOf('searchEverywhereTab: {', tabsStart);
  const tabs = source.slice(tabsStart, tabsEnd);
  assert.match(tabs, /flex: '0 0 44px'/);
  assert.match(tabs, /padding: '0 clamp\(8px, 2cqi, 16px\)'/);
  assert.match(tabs, /borderBottom:/);

  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(dialog, /style: styles\.searchEverywhereActionBar/);
  assert.match(dialog, /slotWidth: 30/);
  assert.match(dialog, /React\.createElement\(CompactActionBar, \{/);
  assert.match(dialog, /role: 'tablist'/);
  assert.match(dialog, /overflowX: 'auto'/);
  assert.match(dialog, /scrollbarWidth: 'none'/);
  assert.match(dialog, /aria-selected': effectiveTab === tab\.id/);
  assert.match(dialog, /handleSearchTabKeyDown\(event\)/);
});

test('tab stop stays on the active tab while all tabs remain reachable', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(dialog, /tabIndex: effectiveTab === tab\.id \? 0 : -1/);
  assert.match(dialog, /cycleTab\(event\.shiftKey \? -1 : 1\)/);
  assert.match(dialog, /searchEverywhereTabTarget\(tabs, effectiveTab, event\.key\)/);
});
