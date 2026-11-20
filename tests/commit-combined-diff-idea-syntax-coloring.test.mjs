import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const moduleSource = await readFile(
  new URL('src/client/components/diff/combined-diff-color-model.ts', root),
  'utf8',
);
const diffSource = await readFile(new URL('src/client/components/diff/DiffPreview.tsx', root), 'utf8');
const buildSource = await readFile(new URL('scripts/build-client.mjs', root), 'utf8');
const combinedDiffBodyLines = loadTypeScriptFunction(moduleSource, 'combinedDiffBodyLines');
const createCombinedDiffColorBudget = loadTypeScriptFunction(moduleSource, 'createCombinedDiffColorBudget');
const takeCombinedDiffColorBudget = loadTypeScriptFunction(moduleSource, 'takeCombinedDiffColorBudget');

test('combined diff body extraction excludes headings and trailing separators', () => {
  const lines = ['===== 1/2 a.js =====', 'const a = 1;', '', '===== 2/2 b.js =====', 'const b = 2;', '', ''];
  assert.deepEqual(combinedDiffBodyLines(lines, { path: 'a.js', line: 1, endLine: 3 }, 'modified'), {
    lines: ['const a = 1;'],
    firstLineNumber: 2,
  });
  assert.deepEqual(combinedDiffBodyLines(lines, { path: 'a.js', originalLine: 4, originalEndLine: 7 }, 'original'), {
    lines: ['const b = 2;'],
    firstLineNumber: 5,
  });
  assert.equal(combinedDiffBodyLines(lines, { path: 'a.js', line: 3, endLine: 3 }, 'modified'), null);
});

test('combined diff colors lexical and semantic ranges with shared theme classes', () => {
  assert.match(moduleSource, /monaco\.editor\.colorize/u);
  assert.match(moduleSource, /ideLightTextStyleRanges/u);
  assert.match(moduleSource, /ideaLightSemanticTokenClass/u);
  assert.match(moduleSource, /inlineClassName/u);
});

test('combined diff colorization is bounded per file and across the aggregate', () => {
  const budget = createCombinedDiffColorBudget(10);
  assert.equal(takeCombinedDiffColorBudget(budget, '1234', 4), true);
  assert.equal(takeCombinedDiffColorBudget(budget, '12345', 4), false);
  assert.equal(takeCombinedDiffColorBudget(budget, '1234567', 10), false);
  assert.equal(takeCombinedDiffColorBudget(budget, '123456', 10), true);
  assert.equal(takeCombinedDiffColorBudget(budget, '1', 10), false);
});

test('DiffPreview applies combined syntax decorations per side and disposes them', () => {
  assert.match(diffSource, /combinedDiffDecorationSpecs/u);
  assert.match(diffSource, /combinedDiffBodyLines/u);
  assert.match(diffSource, /createDecorationsCollection/u);
  assert.match(diffSource, /clearCombinedColorDecorations/u);
  assert.match(diffSource, /swapSidesRef\.current \? 'modified' : 'original'/u);
  assert.match(diffSource, /swapSidesRef\.current \? 'original' : 'modified'/u);
  assert.match(diffSource, /takeCombinedDiffColorBudget/u);
  assert.match(diffSource, /if \(cancelled\) break;/u);
});

test('the browser build registers the combined diff color model', () => {
  assert.match(buildSource, /components', 'diff', 'combined-diff-color-model\.ts'/u);
  assert.match(buildSource, /combinedDiffColorModelModule/u);
});
