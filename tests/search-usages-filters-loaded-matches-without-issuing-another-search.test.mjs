import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const showUsagesSource = await readFile(
  new URL('../src/client/components/search/ShowUsagesPopup.tsx', import.meta.url),
  'utf8',
);
const source = [
  searchEverywhereSource,
  workspaceSource,
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  commitSource,
  showUsagesSource,
].join('\n');

test('Show Usages filters loaded matches without issuing another search', () => {
  const filter = new Function(
    `${transpileTypeScriptFunction(commitSource, 'filterUsageMatches')}; return filterUsageMatches;`,
  )();
  const matches = [
    { path: 'src/Needle.ts', line: 2, column: 1, preview: 'const needle = 1' },
    { path: 'docs/readme.md', line: 4, column: 3, preview: 'Needle appears here' },
    { path: 'src/other.ts', line: 9, column: 1, preview: 'unrelated' },
  ];
  assert.equal(filter(matches, '').length, 3);
  assert.deepEqual(filter(matches, 'needle').map((match) => match.path), [
    'src/Needle.ts',
    'docs/readme.md',
  ]);
  assert.deepEqual(filter(matches, 'OTHER').map((match) => match.path), ['src/other.ts']);
});

test('usage rows have stable identities and indexes clamp to the filtered list', () => {
  const rowKey = new Function(
    `${transpileTypeScriptFunction(commitSource, 'usageMatchRowKey')}; return usageMatchRowKey;`,
  )();
  const normalize = new Function(
    `${transpileTypeScriptFunction(commitSource, 'normalizeUsageMatchIndex')}; return normalizeUsageMatchIndex;`,
  )();
  assert.equal(rowKey({ path: 'src/a.ts', line: 3, column: 7 }), 'usage:src/a.ts:3:7');
  assert.notEqual(rowKey({ path: 'a/b.ts', line: 1, column: 1 }), rowKey({ path: 'a-b.ts', line: 1, column: 1 }));
  assert.equal(normalize([], 9), 0);
  assert.equal(normalize([{}, {}, {}], -4), 0);
  assert.equal(normalize([{}, {}, {}], 99), 2);
});

test('Search Everywhere exposes a distinct Show Usages action and shortcut', () => {
  const actionsStart = workspaceSource.indexOf('const searchEverywhereActions =');
  const actionsEnd = workspaceSource.indexOf('/* Recompute match count', actionsStart);
  const actions = workspaceSource.slice(actionsStart, actionsEnd);
  const start = actions.indexOf("id: 'showUsages'");
  assert.notEqual(start, -1);
  const end = actions.indexOf("id: 'findUsagesInFile'", start);
  const action = actions.slice(start, end);
  assert.match(action, /label: t\('editor\.showUsagesAction'\)/);
  assert.match(action, /description: t\('editor\.showUsagesHint'\)/);
  assert.match(action, /shortcut: ideaUsageFamilyShortcut\('showUsages', searchMacPlatform\)/);
  assert.match(action, /disabled:\s*findUsagesTarget\.query === ''/);
  assert.match(action, /closeSearchEverywhere\(\)/);
  assert.match(action, /openShowUsages\(findUsagesTarget\.query\)/);
});

test('Control+Alt+F7 invokes the transient usage runner outside Search Everywhere', () => {
  const shortcutStart = source.indexOf('const request = findUsagesSearchTarget(currentCodeEditor());');
  const shortcut = source.slice(
    source.lastIndexOf('React.useEffect(() => {', shortcutStart),
    source.indexOf('const key = event.key.toLowerCase();', shortcutStart),
  );
  assert.match(shortcut, /const usageFamilyAction = ideaUsageFamilyShortcutAction\(/);
  assert.match(shortcut, /usageFamilyAction === 'showUsages'\) openShowUsages\(request\.query\)/);
  assert.match(shortcut, /openShowUsages\(request\.query\)/);
});

test('Show Usages popup is transient, keyboard navigable, and can pin to Find', () => {
  const popupStart = showUsagesSource.indexOf('function ShowUsagesPopup(');
  assert.notEqual(popupStart, -1);
  const popup = showUsagesSource.slice(popupStart);
  assert.match(popup, /data-dsh-show-usages=''/);
  assert.match(popup, /role='dialog'/);
  assert.match(popup, /role='listbox'/);
  assert.match(popup, /event\.key === 'ArrowDown'/);
  assert.match(popup, /event\.key === 'ArrowUp'/);
  assert.match(popup, /event\.key === 'Enter'/);
  assert.match(popup, /event\.key === 'Escape'/);
  assert.match(popup, /onClick=\{onPin\}/);
  assert.match(workspaceSource, /const \[showUsages, setShowUsages\] =\s*React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(source, /op: 'searchText'/);
  assert.match(source, /const pinShowUsages = React\.useCallback/);
  assert.match(source, /setShowUsages\(null\);[\s\S]*?openFindTool\(\s*current\.query,\s*'find'/);
});
