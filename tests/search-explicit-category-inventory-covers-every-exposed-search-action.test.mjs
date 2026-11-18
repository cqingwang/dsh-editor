import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function actionIds() {
  const start = source.indexOf('const searchEverywhereActions = React.useMemo(() => [');
  const end = source.indexOf('], [', start);
  assert.ok(start >= 0 && end > start);
  return [...source.slice(start, end).matchAll(/^\s{10}id: '([^']+)',/gm)].map((match) => match[1]);
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
  const ranking = extractFunction('rankSearchActions');
  assert.doesNotMatch(ranking, /category/i);
  assert.match(ranking, /fuzzyScore\(action\.label, needle, \{ caseSensitive, wholeWords \}\)/);
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /const effectiveTab = state\.tab;/);
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.doesNotMatch(dialog, /providerCommand/);
  assert.doesNotMatch(dialog, /showProviderCommands/);
  assert.doesNotMatch(dialog, /providerCommandResults/);
});

test('base tabs are the only result-scope switch', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /if \(effectiveTab === 'files'\) results = fileMatches;/);
  assert.match(dialog, /else if \(effectiveTab === 'text'\) results = textResults;/);
  assert.match(dialog, /else if \(effectiveTab === 'actions'\) results = actionMatches;/);
  assert.match(dialog, /else if \(effectiveQuery === ''\) results = \[/);
  assert.match(dialog, /searchFilters\.files \? fileMatches/);
  assert.match(dialog, /searchFilters\.text \? textResults/);
  assert.match(dialog, /onClick: \(event\) => \{[\s\S]*?onTab\(tab\.id\);/);
});

test('disabled Action Item Info keeps both category and reason', () => {
  const itemInfo = new Function(
    'basename',
    `${extractFunction('searchEverywhereItemInfo')}; return searchEverywhereItemInfo;`,
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
    `${extractFunction('normalizeRecentSearchEntry')}; return normalizeRecentSearchEntry;`,
  )();
  assert.equal(normalize(' /actions replace '), '/actions replace');
  assert.equal(normalize('/text Scoped'), '/text Scoped');
  assert.equal(normalize('/'), '/');
});
