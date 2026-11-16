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

test('Text empty state offers Clear all options only when search options affected the query', () => {
  const offersClearOptions = new Function(
    `${extractFunction('searchEverywhereActiveOptionIds')}; ${extractFunction('searchEverywhereOffersClearOptions')}; return searchEverywhereOffersClearOptions;`,
  )();
  const base = {
    tab: 'text',
    query: 'needle',
    resultCount: 0,
    loading: false,
    caseSensitive: false,
    wholeWords: false,
    regex: false,
    fileMask: '',
  };
  assert.equal(offersClearOptions(base), false);
  assert.equal(offersClearOptions({ ...base, caseSensitive: true }), true);
  assert.equal(offersClearOptions({ ...base, wholeWords: true }), true);
  assert.equal(offersClearOptions({ ...base, regex: true }), true);
  assert.equal(offersClearOptions({ ...base, fileMask: '*.ts' }), true);
  assert.equal(offersClearOptions({ ...base, fileMask: '  ' }), false);
  assert.equal(offersClearOptions({ ...base, tab: 'all', caseSensitive: true }), false);
  assert.equal(offersClearOptions({ ...base, query: ' x ', caseSensitive: true }), false);
  assert.equal(offersClearOptions({ ...base, query: '  ', caseSensitive: true }), false);
  assert.equal(offersClearOptions({ ...base, resultCount: 1, caseSensitive: true }), false);
  assert.equal(offersClearOptions({ ...base, loading: true, caseSensitive: true }), false);
});

test('Clear all options resets only the four search options', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const start = dialog.indexOf('const clearSearchOptions =');
  const end = dialog.indexOf('};', start) + 2;
  const clear = dialog.slice(start, end);
  assert.match(clear, /state\.caseSensitive === true[\s\S]*onToggleCaseSensitive\(\)/);
  assert.match(clear, /state\.wholeWords === true[\s\S]*onToggleWholeWords\(\)/);
  assert.match(clear, /state\.regex === true[\s\S]*onToggleRegex\(\)/);
  assert.match(clear, /String\(state\.fileMask \?\? ''\)\.trim\(\) !== ''[\s\S]*onFileMaskChange\(''\)/);
  assert.doesNotMatch(clear, /onToggleIncludeNonProject|onTogglePreserveCase|onQuery|onTab|setSearchFilters/);
});

test('the Text empty result state exposes IDEA Clear all options', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /const showClearOptionsFallback = searchEverywhereOffersClearOptions\(\{/);
  assert.match(dialog, /data-dsh-search-clear-options/);
  assert.match(dialog, /onClick: clearSearchOptions/);
  assert.match(dialog, /t\('editor\.searchClearAllOptions'\)/);
  assert.match(dialog, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.equal((source.match(/searchClearAllOptions:/g) ?? []).length, 2);
});
