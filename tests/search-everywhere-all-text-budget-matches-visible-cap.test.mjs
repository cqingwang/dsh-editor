import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('the Host text budget never exceeds the rows the active Search Everywhere tab renders', () => {
  const functionCode = transpileTypeScriptFunction(commitSource, 'searchEverywhereTextRequestLimit');
  const limit = new Function(
    'SEARCH_EVERYWHERE_ALL_TEXT_RESULT_LIMIT',
    'SEARCH_EVERYWHERE_TEXT_TAB_RESULT_LIMIT',
    `${functionCode}\nreturn searchEverywhereTextRequestLimit;`,
  )(40, 200);

  assert.equal(limit('all'), 40);
  assert.equal(limit('text'), 200);
  assert.equal(limit('files'), 40);
  assert.match(
    commitSource,
    /SEARCH_EVERYWHERE_ALL_FILE_RESULT_LIMIT = 24;/u,
  );
  assert.match(
    searchEverywhereSource,
    /textResults\.slice\(0, SEARCH_EVERYWHERE_ALL_TEXT_RESULT_LIMIT\)/u,
  );
});

test('Search Everywhere forwards the tab-specific text budget instead of a fixed 200', () => {
  assert.match(
    editorSource,
    /query: searchEverywhereTextQuery,[\s\S]{0,220}?maxMatches: searchEverywhereTextRequestLimit\(searchEverywhere\?\.tab\),/u,
  );
  assert.doesNotMatch(
    editorSource,
    /query: searchEverywhereTextQuery,[\s\S]{0,220}?maxMatches: 200,/u,
  );
});
