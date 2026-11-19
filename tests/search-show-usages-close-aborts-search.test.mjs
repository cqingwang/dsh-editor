import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('closing Show Usages aborts its in-flight search', () => {
  const showUsagesRequestRef = { current: 4 };
  const showUsagesAbortRef = { current: new AbortController() };
  let state = { query: 'symbol' };
  const closeShowUsages = loadTypeScriptCallback(source, 'closeShowUsages', {
    showUsagesRequestRef,
    showUsagesAbortRef,
    setShowUsages: (value) => {
      state = value;
    },
  });

  closeShowUsages();

  assert.equal(showUsagesRequestRef.current, 5);
  assert.equal(showUsagesAbortRef.current, null);
  assert.equal(state, null);
});

test('Show Usages search carries the abort signal', () => {
  assert.match(source, /const searchAbort = new AbortController\(\);/u);
  assert.match(source, /op: 'searchText',\s+query: textQuery,\s+maxMatches: 200,\s*\},\s*\{ signal: searchAbort\.signal \}/u);
  assert.match(source, /onClose=\{closeShowUsages\}/u);
});
