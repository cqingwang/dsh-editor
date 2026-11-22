import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');

test('editing a Search Everywhere query clears the previous text generation immediately', () => {
  const { searchEverywhereQueryTransition } = loadTypeScriptModule(commitSource, [
    'searchEverywhereQueryTransition',
  ]);
  const previous = {
    query: 'activityThread',
    files: [{ path: 'tests/ppkit_module_contract_test.ts' }],
    filesScope: false,
    filesTruncated: false,
    textMatches: [{ path: 'old.ts', line: 1, column: 1, preview: 'activityThread' }],
    textLoading: false,
    textTruncated: true,
    error: 'old text failure',
    errorSource: 'text',
    includeNonProject: false,
    index: 4,
    activeRowKey: 'text:old.ts:1:1',
  };

  const searching = searchEverywhereQueryTransition(previous, 'ActivityThread');
  assert.equal(searching.query, 'ActivityThread');
  assert.deepEqual(searching.textMatches, []);
  assert.equal(searching.textLoading, true);
  assert.equal(searching.textTruncated, false);
  assert.equal(searching.error, null);
  assert.equal(searching.errorSource, null);
  assert.equal(searching.index, 0);
  assert.equal(searching.activeRowKey, null);
  assert.deepEqual(searching.files, previous.files);

  const cleared = searchEverywhereQueryTransition(searching, '');
  assert.equal(cleared.textLoading, false);
  assert.deepEqual(cleared.textMatches, []);
  assert.equal(cleared.textTruncated, false);
});

test('a files-provider error survives query edits while text-provider state is cleared', () => {
  const { searchEverywhereQueryTransition } = loadTypeScriptModule(commitSource, [
    'searchEverywhereQueryTransition',
  ]);
  const next = searchEverywhereQueryTransition(
    {
      query: 'old',
      textMatches: [],
      textLoading: false,
      textTruncated: false,
      error: 'cannot enumerate files',
      errorSource: 'files',
    },
    'new',
  );
  assert.equal(next.error, 'cannot enumerate files');
  assert.equal(next.errorSource, 'files');
});
