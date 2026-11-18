import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const searchEverywhere = client.slice(
  client.indexOf('function SearchEverywhere('),
  client.indexOf('function FindToolWindow('),
);

test('Search Everywhere error owns the only live announcement', () => {
  assert.match(
    searchEverywhere,
    /const searchResultStatus = error !== null\s+\? ''\s+: textLoading/u,
  );
  assert.match(
    searchEverywhere,
    /error !== null\s+\? React\.createElement\('div', \{ style: styles\.searchEverywhereError, role: 'alert' \}, error\)/u,
  );
});

test('Search Everywhere error does not render a conflicting empty-result state', () => {
  assert.match(
    searchEverywhere,
    /results\.length === 0 && !textLoading && error === null/u,
  );
});
