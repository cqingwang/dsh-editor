import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const dialog = source.slice(
  source.indexOf('function SearchEverywhere('),
  source.indexOf('function ShowUsagesPopup('),
);
const handoff = source.slice(
  source.indexOf('function searchFindHandoff('),
  source.indexOf('function findToolContentQuery('),
);

test('Search Everywhere keeps Open in Find Tool Window available for non-empty zero results', () => {
  assert.match(dialog, /disabled: effectiveQuery === '',/u);
  assert.doesNotMatch(dialog, /disabled: effectiveQuery === '' \|\| \(fileMatches\.length === 0/u);
  assert.match(dialog, /onOpenInFindToolWindow\(refresh === true \? \{ \.\.\.request\.request, refresh: true \} : request\.request\)/u);
});

test('The zero-result handoff still preserves the literal query', () => {
  assert.match(handoff, /query: typeof query === 'string' \? query : ''/u);
  assert.match(handoff, /files:/u);
  assert.match(handoff, /matches:/u);
});
