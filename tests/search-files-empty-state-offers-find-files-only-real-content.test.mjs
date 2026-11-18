import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('Files empty state offers Find in Files only for a real content query', () => {
  const offersFindInFiles = new Function(
    `${extractFunction('searchEverywhereOffersFindInFiles')}; return searchEverywhereOffersFindInFiles;`,
  )();
  assert.equal(offersFindInFiles({ tab: 'files', query: 'needle', resultCount: 0, loading: false }), true);
  assert.equal(offersFindInFiles({ tab: 'all', query: 'needle', resultCount: 0, loading: false }), false);
  assert.equal(offersFindInFiles({ tab: 'text', query: 'needle', resultCount: 0, loading: false }), false);
  assert.equal(offersFindInFiles({ tab: 'actions', query: 'needle', resultCount: 0, loading: false }), false);
  assert.equal(offersFindInFiles({ tab: 'files', query: '  ', resultCount: 0, loading: false }), false);
  assert.equal(offersFindInFiles({ tab: 'files', query: 'needle', resultCount: 1, loading: false }), false);
  assert.equal(offersFindInFiles({ tab: 'files', query: 'needle', resultCount: 0, loading: true }), false);
});

test('Files empty state hands the query to the persistent Find tool with a fresh search', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const openShowUsages = React.useCallback'),
  );
  assert.match(dialog, /const showFindInFilesFallback = searchEverywhereOffersFindInFiles\(\{/);
  assert.match(dialog, /data-dsh-search-find-in-files/);
  assert.match(dialog, /openSearchResultsInFind\(null, null, \{\s+refresh: true,\s+\}\)/u);
  assert.match(dialog, /t\('editor\.searchFindInFilesFallback'\)/);
  assert.match(dialog, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(openFind, /initial\?\.refresh === true/);
  assert.equal((source.match(/searchFindInFilesFallback:/g) ?? []).length, 2);
});

test('Reset filter is limited to the All tab where provider filters apply', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(dialog, /const canResetSearchFilters = effectiveTab === 'all' && searchEverywhereFiltersNeedReset\(searchFilters\)/);
});
