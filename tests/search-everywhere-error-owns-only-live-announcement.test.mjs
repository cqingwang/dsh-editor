import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractFunctionSource, loadTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const client = searchEverywhereSource + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const searchEverywhere = client.slice(
  client.indexOf('function SearchEverywhere('),
  client.indexOf('function FindToolWindowView('),
);

test('Search Everywhere error owns the only live announcement', () => {
  assert.match(searchEverywhere, /const searchResultStatus =\s+visibleError !== null\s+\? ''\s+: textLoading/u);
  assert.match(
    searchEverywhere,
    /visibleError !== null \? \(\s*<div\s+style=\{styles\.searchEverywhereError\}\s+role='alert'>\s*<span>\{visibleError\}<\/span>[\s\S]*?state\.errorSource === 'files'[\s\S]*?t\('editor\.searchFilesRetry'\)/u,
  );
  assert.match(
    searchEverywhere,
    /state\.errorSource === 'text'[\s\S]*?onClick=\{\(\) => retryProvider\(onRetryText\)\}[\s\S]*?t\('editor\.searchTextRetry'\)/u,
  );
  assert.match(searchEverywhere, /retryProvider\(onRetryFiles\)/u);
  assert.match(
    searchEverywhere,
    /const retryProvider = \(retry: \(\) => void\): void => \{\s+if \(!claimSearchProviderRetry\(providerRetryGuardRef\)\) return;\s+retry\(\);\s+window\.setTimeout\(\(\) => \{\s+providerRetryGuardRef\.current = false;\s+searchInputRef\.current\?\.focus\?\.\(\);\s+\}, 0\);\s+\}/u,
  );
});

test('Search Everywhere error does not render a conflicting empty-result state', () => {
  assert.match(searchEverywhere, /results\.length === 0 && !textLoading && visibleError === null/u);
});

test('provider errors are visible only while their owning provider is visible', () => {
  const errorIsVisible = loadTypeScriptFunction(
    extractFunctionSource(searchEverywhereSource, 'searchEverywhereErrorIsVisible'),
    'searchEverywhereErrorIsVisible',
  );
  const filesVisible = { files: true, text: true };
  const filesHidden = { files: false, text: true };

  assert.equal(errorIsVisible('files', 'files', filesHidden), true);
  assert.equal(errorIsVisible('files', 'all', filesVisible), true);
  assert.equal(errorIsVisible('files', 'all', filesHidden), false);
  assert.equal(errorIsVisible('files', 'actions', filesVisible), false);
  assert.equal(errorIsVisible('text', 'text', filesHidden), true);
  assert.equal(errorIsVisible('text', 'all', { files: true, text: false }), false);
  assert.equal(errorIsVisible(null, 'actions', filesHidden), true);
});
