import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

test('text-specific empty-result copy has one reusable source', () => {
  const emptyResultKind = new Function(
    `${transpileTypeScriptFunction(source, 'searchEverywhereEmptyResultKind')}\nreturn searchEverywhereEmptyResultKind;`,
  )();
  assert.equal(emptyResultKind('text', 0), 'text-hint');
  assert.equal(emptyResultKind('text', 1), 'text-hint');
  assert.equal(emptyResultKind('text', 2), 'no-matches');
  assert.equal(emptyResultKind('all', 1), 'no-matches');
});

test('the short-text hint is not rendered as a second standalone message', () => {
  assert.doesNotMatch(
    source,
    /<div style=\{styles\.searchEverywhereMessage\}>\{t\('editor\.searchTextHint'\)\}<\/div>/u,
  );
  assert.match(source, /const emptyResultLabel =/u);
  assert.match(source, /\{emptyResultLabel\}/u);
});
