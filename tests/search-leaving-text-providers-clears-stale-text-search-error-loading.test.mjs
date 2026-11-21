import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const client =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'));

test('leaving text providers clears a stale text-search error and loading state', () => {
  const transition = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTabTransition')}\nreturn searchEverywhereTabTransition;`,
  )();
  const next = transition(
    {
      tab: 'all',
      query: 'endValue',
      index: 4,
      error: 'synthetic failure',
      textLoading: true,
    },
    'actions',
  );
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
  const next = transition(
    {
      tab: 'all',
      query: 'endValue',
      index: 3,
      error: 'old error',
      textLoading: true,
    },
    'text',
  );
  assert.equal(next.tab, 'text');
  assert.equal(next.index, 0);
  assert.equal(next.error, null);
  assert.equal(next.textLoading, true);
});

test('provider-owned errors survive a tab switch and reappear with their provider', () => {
  const transition = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTabTransition')}\nreturn searchEverywhereTabTransition;`,
  )();
  const filesError = {
    tab: 'files',
    query: '',
    index: 0,
    error: 'file enumeration failed',
    errorSource: 'files',
    textLoading: false,
  };
  const actions = transition(filesError, 'actions');
  assert.equal(actions.error, 'file enumeration failed');
  assert.equal(actions.errorSource, 'files');
  const files = transition(actions, 'files');
  assert.equal(files.error, 'file enumeration failed');
  assert.equal(files.errorSource, 'files');
});

test('text Retry clears its error and advances the search generation', () => {
  const retryState = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTextRetryState')}\nreturn searchEverywhereTextRetryState;`,
  )();
  const next = retryState({
    query: 'needle',
    error: 'text search failed',
    errorSource: 'text',
    textRevision: 4,
  });
  assert.equal(next.query, 'needle');
  assert.equal(next.error, null);
  assert.equal(next.errorSource, null);
  assert.equal(next.textRevision, 5);
});

test('a below-minimum text query clears only text-owned stale state', () => {
  const idleState = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereTextIdleState')}\nreturn searchEverywhereTextIdleState;`,
  )();
  const textError = idleState({
    query: 'n',
    textMatches: [{ path: 'stale.ts', line: 1, column: 1 }],
    textLoading: true,
    textTruncated: true,
    error: 'text search failed',
    errorSource: 'text',
  });
  assert.deepEqual(textError, {
    query: 'n',
    textMatches: [],
    textLoading: false,
    textTruncated: false,
    error: null,
    errorSource: null,
  });

  const filesError = {
    query: 'n',
    textMatches: [],
    textLoading: false,
    textTruncated: false,
    error: 'file enumeration failed',
    errorSource: 'files',
  };
  assert.deepEqual(idleState(filesError), filesError);
});

test('files Retry clears the owning error immediately and ignores another scope', () => {
  const requestState = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereFilesRequestState')}\nreturn searchEverywhereFilesRequestState;`,
  )();
  const current = {
    includeNonProject: true,
    error: 'file enumeration failed',
    errorSource: 'files',
  };
  assert.deepEqual(requestState(current, true), {
    includeNonProject: true,
    error: null,
    errorSource: null,
  });
  assert.equal(requestState(current, false), current);
});

test('EditorWorkspace routes Search Everywhere tab changes through that transition', () => {
  assert.match(
    client,
    /onTab=\{\(tab\) =>\s*setSearchEverywhere\(\(current\) =>\s*current === null \? current : searchEverywhereTabTransition\(current, tab\),?\s*\)/u,
  );
  assert.match(
    client,
    /if \(searchEverywhereTextQuery\.length < 2\) \{\s*setSearchEverywhere\(searchEverywhereTextIdleState\);\s*return undefined;/u,
  );
});
