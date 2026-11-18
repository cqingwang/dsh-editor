import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const commit = await read('src/client/commit.ts');
const helpers = loadTypeScriptModule(commit, [
  'codePreviewMatchRanges',
  'findToolPreviewLineParts',
  'findToolTextLineStarts',
  'groupFindMatches',
  'normalizeFindGroupBy',
  'normalizeFindQueryHistoryEntry',
  'normalizeRecentSearchEntry',
  'previewLineScrollTop',
  'rememberFindQueryHistory',
  'searchEverywhereActiveOptionIds',
  'searchEverywhereOffersClearOptions',
  'searchEverywhereOffersFindInFiles',
  'searchEverywhereOffersScopeExpansion',
  'searchEverywherePreviewWindow',
  'searchEverywhereRequiresResultConfirmation',
]);

test('TypeScript commit helpers preserve preview, grouping and history behavior', () => {
  assert.deepEqual(helpers.searchEverywherePreviewWindow('a\nb\nc\nd\ne', 4, 3), {
    start: 3,
    end: 5,
    truncatedBefore: true,
    truncatedAfter: false,
  });
  assert.equal(
    helpers.previewLineScrollTop({
      containerTop: 100,
      containerHeight: 200,
      scrollTop: 20,
      scrollHeight: 1000,
      lineTop: 400,
      lineHeight: 20,
    }),
    230,
  );
  assert.deepEqual(helpers.findToolTextLineStarts('a\nb\n'), [0, 2, 4]);
  assert.deepEqual(
    helpers.findToolPreviewLineParts('abcdef', 10, [
      { offset: 8, length: 4 },
      { offset: 11, length: 3 },
    ]),
    [
      { text: 'abcd', match: true },
      { text: 'ef', match: false },
    ],
  );
  assert.deepEqual(
    helpers.codePreviewMatchRanges([
      { text: 'a', match: false },
      { text: 'bc', match: true },
      { text: 'd', match: false },
    ]),
    [{ start: 1, end: 3 }],
  );
  assert.deepEqual(
    helpers
      .groupFindMatches([
        { path: 'a.ts', line: 1 },
        { path: 'b.ts', line: 2 },
        { path: 'a.ts', line: 3 },
      ])
      .map((group) => [group.path, group.matches.length]),
    [
      ['a.ts', 2],
      ['b.ts', 1],
    ],
  );
  assert.equal(helpers.normalizeFindGroupBy('directory'), 'directory');
  assert.equal(helpers.normalizeFindGroupBy('other'), 'file');
  assert.equal(helpers.normalizeRecentSearchEntry('  literal query  '), 'literal query');
  assert.equal(helpers.normalizeFindQueryHistoryEntry('  literal\n'), '  literal\n');
  assert.deepEqual(helpers.rememberFindQueryHistory(['a', 'b'], 'a', 2), ['a', 'b']);
  assert.equal(helpers.searchEverywhereRequiresResultConfirmation([], Array(201).fill({}), 200), true);
});

test('TypeScript commit helpers preserve Search Everywhere empty-state actions', () => {
  assert.deepEqual(
    helpers.searchEverywhereActiveOptionIds({
      caseSensitive: true,
      wholeWords: false,
      regex: true,
      fileMask: '*.ts',
    }),
    ['case', 'regex', 'fileMask'],
  );
  assert.equal(
    helpers.searchEverywhereOffersFindInFiles({
      tab: 'files',
      query: 'component',
      resultCount: 0,
      loading: false,
    }),
    true,
  );
  assert.equal(
    helpers.searchEverywhereOffersClearOptions({
      tab: 'text',
      query: 'component',
      resultCount: 0,
      loading: false,
      regex: true,
    }),
    true,
  );
  assert.equal(
    helpers.searchEverywhereOffersScopeExpansion({
      tab: 'all',
      query: 'x',
      resultCount: 0,
      loading: false,
      includeNonProject: false,
    }),
    true,
  );
  assert.equal(
    helpers.searchEverywhereOffersScopeExpansion({
      tab: 'all',
      query: 'x',
      resultCount: 0,
      loading: false,
      includeNonProject: true,
    }),
    false,
  );
});
