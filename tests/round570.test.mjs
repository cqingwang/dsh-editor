import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Search Everywhere has no production provider command parser', () => {
  assert.doesNotMatch(source, /function searchEverywhereProviderCommand\(/);
  assert.doesNotMatch(source, /function searchEverywhereContentQuery\(/);
});

test('the selected tab owns provider scope and query text stays literal', () => {
  const dialogStart = source.indexOf('function SearchEverywhere({');
  const dialogEnd = source.indexOf('function SearchResultTooltip', dialogStart);
  const dialog = source.slice(dialogStart, dialogEnd);
  assert.match(dialog, /const effectiveTab = state\.tab;/);
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.match(dialog, /'aria-selected': effectiveTab === tab\.id/);
  assert.match(dialog, /value: state\.query/);
  assert.doesNotMatch(dialog, /providerCommand/);
  assert.match(dialog, /query: effectiveQuery,/);
});

test('background Text search consumes the literal active-tab query', () => {
  const start = source.indexOf('const searchEverywhereRawQuery');
  const end = source.indexOf('/**\n       * Move a Search Everywhere result set', start);
  const block = source.slice(start, end);
  assert.match(block, /const searchEverywhereTextQuery = searchEverywhereRawQuery;/);
  assert.match(block, /searchEverywhere\.tab === 'all' \|\| searchEverywhere\.tab === 'text'/);
  assert.doesNotMatch(block, /searchEverywhereProvider/);
});

test('Text action returns focus to the Search Everywhere query field', () => {
  const start = source.indexOf("id: 'textSearch'");
  const end = source.indexOf("id: 'showSearchHistory'", start);
  const action = source.slice(start, end);
  assert.match(action, /data-dsh-search-query/);
  assert.match(action, /window\.setTimeout\(\(\) => document\.querySelector\('\[data-dsh-search-query\]'\)\?\.focus\?\.\(\), 0\)/);
});
