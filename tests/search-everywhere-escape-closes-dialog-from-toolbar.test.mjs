import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

test('Search Everywhere Escape dismisses unless item info owns the first Escape', () => {
  const escapeTarget = new Function(
    `${transpileTypeScriptFunction(source, 'searchEverywhereEscapeTarget')}; return searchEverywhereEscapeTarget;`,
  )();
  assert.equal(escapeTarget(false), 'dismiss');
  assert.equal(escapeTarget(true), 'close-result-info');
});

test('the dialog key handler applies Escape outside query and result focus', () => {
  const handlerStart = source.indexOf('const handleSearchEverywhereDialogKeyDown');
  const handlerEnd = source.indexOf('const handledHistoryRequestRef', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.match(handler, /event\.key === 'Escape'/u);
  assert.match(handler, /searchEverywhereEscapeTarget\(resultInfo !== null\)/u);
  assert.match(handler, /dismissSearchEverywhere\(\)/u);
  assert.match(handler, /closeResultInfo\(\)/u);
});
