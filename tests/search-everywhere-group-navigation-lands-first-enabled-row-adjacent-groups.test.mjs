import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');

test('Search Everywhere group navigation lands on the first enabled row of adjacent groups', () => {
  const factory = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereResultGroupKey')}; ${transpileTypeScriptFunction(commitSource, 'searchEverywhereGroupTargetIndex')}; return searchEverywhereGroupTargetIndex;`,
  )();
  const results = [
    { kind: 'action' },
    { kind: 'action', disabled: true },
    { kind: 'file', disabled: true },
    { kind: 'file' },
    { kind: 'text' },
  ];
  assert.equal(factory(results, 0, 1), 3);
  assert.equal(factory(results, 3, -1), 0);
  assert.equal(factory(results, 4, -1), 3);
  assert.equal(factory(results, 4, 1), null);
  assert.equal(factory([], 0, 1), null);
});

test('recent searches form a separate group from Actions', () => {
  const fn = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereResultGroupKey')}; return searchEverywhereResultGroupKey;`,
  )();
  assert.equal(fn({ history: true, kind: 'action' }), 'recent');
  assert.equal(fn({ kind: 'action' }), 'action');
  assert.equal(fn({ kind: 'file' }), 'file');
  assert.equal(fn({ kind: 'text' }), 'text');
  assert.equal(fn(null), 'other');
});

test('Search Everywhere binds IDEA next/previous group keys', () => {
  const handler = source.slice(
    source.indexOf('const handleSearchResultKeyDown = (event) => {'),
    source.indexOf('const openSearchResultsInFind =', source.indexOf('const handleSearchResultKeyDown = (event) => {')),
  );
  assert.match(handler, /searchEverywhereGroupNavigationDirection\(event, macPlatform\)/);
  assert.match(handler, /searchEverywhereGroupTargetIndex\(results, activeIndex, groupDirection\)/);
});
