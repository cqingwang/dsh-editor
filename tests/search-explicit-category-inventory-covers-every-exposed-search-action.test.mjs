import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'));

function actionIds() {
  const start = source.indexOf('const searchEverywhereActions =');
  const end = source.indexOf('/* Recompute match count', start);
  assert.ok(start >= 0 && end > start);
  return [...source.slice(start, end).matchAll(/^\s*id: '([^']+)',/gm)].map((match) => match[1]);
}

function categoryInventory() {
  const start = source.indexOf('const SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS');
  const tail = source.slice(start).match(/\]\s*\);/u);
  const end = tail === null ? -1 : start + tail.index + tail[0].length;
  assert.ok(start >= 0 && end > start);
  return new Function(`${source.slice(start, end)}; return SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS;`)();
}

test('explicit category inventory covers every exposed search Action', () => {
  const ids = actionIds();
  const inventory = categoryInventory();
  assert.equal(ids.length, 33);
  assert.deepEqual([...inventory.keys()].sort(), [...ids].sort());
  assert.equal([...inventory.values()].filter((value) => value === 'editor.searchCategoryNavigate').length, 6);
  assert.equal([...inventory.values()].filter((value) => value === 'editor.searchCategoryEditFind').length, 18);
  assert.equal([...inventory.values()].filter((value) => value === 'editor.searchCategoryEditFindUsages').length, 6);
  assert.deepEqual(
    [...inventory.entries()]
      .filter(([, value]) => value === null)
      .map(([id]) => id)
      .sort(),
    ['findToolWindow', 'incrementalSearch', 'searchWeb'],
  );
});

test('category is presentation metadata and never action filtering input', () => {
  const ranking = transpileTypeScriptFunction(commitSource, 'rankSearchActions');
  assert.doesNotMatch(ranking, /category/i);
  assert.match(ranking, /fuzzyScore\(action\.label, needle, \{\s*caseSensitive,\s*wholeWords,?\s*\}\)/u);
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const effectiveTab = state\.tab;/);
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.doesNotMatch(dialog, /providerCommand/);
  assert.doesNotMatch(dialog, /showProviderCommands/);
  assert.doesNotMatch(dialog, /providerCommandResults/);
});

test('base tabs are the only result-scope switch', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /if \(effectiveTab === 'files'\) return fileMatches;/);
  assert.match(dialog, /if \(effectiveTab === 'text'\) return textResults;/);
  assert.match(dialog, /if \(effectiveTab === 'actions'\) return actionMatches;/);
  assert.match(dialog, /if \(effectiveQuery === ''\)\s+return \[/u);
  assert.match(dialog, /searchFilters\.files \? fileMatches/);
  assert.match(dialog, /searchFilters\.text \? textResults/);
  assert.match(dialog, /onClick=\{\(event\) => \{[\s\S]*?onTab\(tab\.id\);/);
});

test('disabled Action Item Info keeps both category and reason', () => {
  const itemInfo = new Function(
    'basename',
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereItemInfo')}; return searchEverywhereItemInfo;`,
  )((path) => path);
  assert.deepEqual(
    itemInfo(
      {
        kind: 'action',
        label: 'Find Usages Settings…',
        description: 'Choose scope',
        category: 'Edit | Find Usages',
        disabled: true,
        disabledReason: 'Text search has no language scope',
      },
      (key) => key,
    ),
    {
      kind: 'editor.searchItemKindAction',
      title: 'Find Usages Settings…',
      detail: 'Choose scope',
      meta: 'Edit | Find Usages · Text search has no language scope',
    },
  );
});

test('literal slash queries remain replayable search text', () => {
  const normalize = new Function(
    `${transpileTypeScriptFunction(commitSource, 'normalizeRecentSearchEntry')}; return normalizeRecentSearchEntry;`,
  )();
  assert.equal(normalize(' /actions replace '), '/actions replace');
  assert.equal(normalize('/text Scoped'), '/text Scoped');
  assert.equal(normalize('/'), '/');
});
