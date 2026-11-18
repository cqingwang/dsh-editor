import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const client = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'));

test('leaving text providers clears a stale text-search error and loading state', () => {
  const transition = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTabTransition')}\nreturn searchEverywhereTabTransition;`,
  )();
  const next = transition({
    tab: 'all',
    query: 'endValue',
    index: 4,
    error: 'synthetic failure',
    textLoading: true,
  }, 'actions');
  assert.deepEqual(next, {
    tab: 'actions',
    query: 'endValue',
    index: 0,
    error: null,
    textLoading: false,
  });
});

test('switching between text-capable tabs preserves the in-flight loading state', () => {
  const transition = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTabTransition')}\nreturn searchEverywhereTabTransition;`,
  )();
  const next = transition({
    tab: 'all',
    query: 'endValue',
    index: 3,
    error: 'old error',
    textLoading: true,
  }, 'text');
  assert.equal(next.tab, 'text');
  assert.equal(next.index, 0);
  assert.equal(next.error, null);
  assert.equal(next.textLoading, true);
});

test('EditorWorkspace routes Search Everywhere tab changes through that transition', () => {
  assert.match(
    client,
    /onTab=\{\(tab\) =>\s*setSearchEverywhere\(\(current\) => \(current === null \? current : searchEverywhereTabTransition\(current, tab\)\)\)/u,
  );
});
