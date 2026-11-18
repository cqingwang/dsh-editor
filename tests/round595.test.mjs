import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('All and Text empty states offer scope expansion only from project scope', () => {
  const offersScopeExpansion = new Function(
    `${extractFunction('searchEverywhereOffersScopeExpansion')}; return searchEverywhereOffersScopeExpansion;`,
  )();
  const base = {
    tab: 'all',
    query: 'needle',
    resultCount: 0,
    loading: false,
    includeNonProject: false,
  };
  assert.equal(offersScopeExpansion(base), true);
  assert.equal(offersScopeExpansion({ ...base, tab: 'text' }), true);
  assert.equal(offersScopeExpansion({ ...base, tab: 'files' }), false);
  assert.equal(offersScopeExpansion({ ...base, tab: 'actions' }), false);
  assert.equal(offersScopeExpansion({ ...base, includeNonProject: true }), false);
  assert.equal(offersScopeExpansion({ ...base, query: '  ' }), false);
  assert.equal(offersScopeExpansion({ ...base, resultCount: 1 }), false);
  assert.equal(offersScopeExpansion({ ...base, loading: true }), false);
  assert.equal(offersScopeExpansion({ ...base, tab: 'text', query: ' x ' }), false);
  assert.equal(offersScopeExpansion({ ...base, tab: 'all', query: ' x ' }), true);
});

test('scope expansion changes only Include non-project scope', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const start = dialog.indexOf('const expandSearchScope =');
  const end = dialog.indexOf('const previewWindow =', start);
  const expand = dialog.slice(start, end);
  assert.match(expand, /state\.includeNonProject !== true/);
  assert.match(expand, /onToggleIncludeNonProject\(\)/);
  assert.match(expand, /searchInputRef\.current\?\.focus\?\.\(\)/);
  assert.doesNotMatch(expand, /onToggleCaseSensitive|onToggleWholeWords|onToggleRegex|onTogglePreserveCase|onFileMaskChange|onQuery|onTab|setSearchFilters|clearSearchOptions/);
});

test('All and Text empty states expose the independent scope action', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /const showScopeExpansionFallback = searchEverywhereOffersScopeExpansion\(\{/);
  assert.match(dialog, /data-dsh-search-expand-scope/);
  assert.match(dialog, /onClick: expandSearchScope/);
  assert.match(dialog, /t\('editor\.searchExpandScope'\)/);
  assert.match(dialog, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.equal((source.match(/searchExpandScope:/g) ?? []).length, 2);
});
