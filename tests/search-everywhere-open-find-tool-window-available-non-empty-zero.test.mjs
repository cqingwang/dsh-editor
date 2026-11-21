import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const dialog = source.slice(
  source.indexOf('function SearchEverywhere('),
  source.indexOf('function ShowUsagesPopup('),
);

test('Search Everywhere keeps Open in Find Tool Window available for non-empty zero results', () => {
  assert.match(dialog, /disabled: effectiveQuery === '',/u);
  assert.doesNotMatch(dialog, /disabled: effectiveQuery === '' \|\| \(fileMatches\.length === 0/u);
  assert.match(dialog, /onOpenInFindToolWindow\(/);
  assert.match(dialog, /refresh === true/);
  assert.match(dialog, /request\.request/);
  assert.match(dialog, /as FindHandoffRequest/);
});

test('The zero-result handoff still preserves the literal query', () => {
  const searchFindHandoff = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereRequiresResultConfirmation')}; ${transpileTypeScriptFunction(commitSource, 'searchFindHandoff')}; return searchFindHandoff;`,
  )();
  const request = searchFindHandoff({
    query: '  literal query  ',
    files: [],
    matches: [],
  }).request;

  assert.equal(request.query, '  literal query  ');
  assert.deepEqual(request.files, []);
  assert.deepEqual(request.matches, []);
});
