import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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

test('Reset filter re-enables every Search Everywhere provider', () => {
  const defaults = new Function(
    `${extractFunction('defaultSearchEverywhereFilters')}; return defaultSearchEverywhereFilters;`,
  )();
  const needsReset = new Function(
    `${extractFunction('searchEverywhereFiltersNeedReset')}; return searchEverywhereFiltersNeedReset;`,
  )();
  const reset = defaults();
  assert.deepEqual(reset, { files: true, text: true, actions: true });
  assert.notEqual(defaults(), reset, 'each reset must return a fresh state object');
  assert.equal(needsReset({ files: true, text: true, actions: true }), false);
  assert.equal(needsReset({ files: true, text: false, actions: true }), true);
  assert.equal(needsReset(null), false);
});

test('Reset filter preserves the query, scope, options and File Mask', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const resetStart = dialog.indexOf('const resetSearchFilters = React.useCallback');
  const resetEnd = dialog.indexOf('}, []);', resetStart) + '}, []);'.length;
  const reset = dialog.slice(resetStart, resetEnd);
  assert.match(reset, /setSearchFilters\(defaultSearchEverywhereFilters\(\)\)/);
  assert.match(reset, /setFilterMenu\(null\)/);
  assert.match(reset, /searchInputRef\.current\?\.focus\?\.\(\)/);
  assert.doesNotMatch(reset, /onQuery|onTab|onToggle|onFileMaskChange/);
});

test('the empty result state exposes the IDEA Reset filter link', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /const canResetSearchFilters = effectiveTab === 'all' && searchEverywhereFiltersNeedReset\(searchFilters\)/);
  assert.match(dialog, /data-dsh-search-reset-filter/);
  assert.match(dialog, /canResetSearchFilters \? React\.createElement\(\s*'button'/);
  assert.match(dialog, /t\('editor\.searchResetFilters'\)/);
  assert.match(dialog, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.equal((source.match(/searchResetFilters:/g) ?? []).length, 2);
});
