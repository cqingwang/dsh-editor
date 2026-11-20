import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('Search Everywhere uses singular result wording for exactly one hit', () => {
  const label = new Function(
    `${transpileTypeScriptFunction(source, 'searchResultStatusLabel')}; return searchResultStatusLabel;`,
  )();
  const calls = [];
  const t = (key, params) => {
    calls.push({ key, params });
    return key;
  };
  assert.equal(label(1, t), 'editor.searchResultCountOne');
  assert.equal(label(81, t), 'editor.searchResultCount');
  assert.deepEqual(calls, [
    { key: 'editor.searchResultCountOne', params: undefined },
    { key: 'editor.searchResultCount', params: { count: 81 } },
  ]);
});

test('Search Everywhere status reuses the singular helper and both dictionaries', () => {
  assert.match(source, /searchResultStatusLabel\(results\.length, t\)/u);
  assert.match(locales, /searchResultCountOne: '找到 1 个结果'/u);
  assert.match(locales, /searchResultCountOne: '1 result'/u);
});
