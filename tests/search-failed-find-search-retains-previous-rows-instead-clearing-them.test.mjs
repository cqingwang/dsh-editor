import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('A failed Find search retains the previous rows instead of clearing them', () => {
  const effectStart = source.indexOf(
    'if (!findToolOpen || findTool.loadedGeneration === findTool.searchGeneration)',
  );
  const effectEnd = source.indexOf("/* IDEA's Find Action chord", effectStart);
  const effect = source.slice(effectStart, effectEnd);
  assert.ok(effectStart >= 0 && effectEnd > effectStart);
  const catchStart = effect.indexOf('.catch((failure) => {');
  const catchBlock = effect.slice(catchStart);
  assert.ok(catchStart >= 0);
  assert.doesNotMatch(catchBlock, /files: \[\]/u);
  assert.doesNotMatch(catchBlock, /matches: \[\]/u);
  assert.match(catchBlock, /truncated: false/u);
  assert.match(catchBlock, /loading: false/u);
  assert.match(catchBlock, /error: searchTextFailureMessage\(failure, t\)/u);
});

test('Find error state owns the live status and retained-result rendering', () => {
  assert.match(findTool, /const findResultStatus =\s+state\.error !== null\s+\? ''\s+: state\.loading === true/u);
  assert.match(
    findTool,
    /const retainPreviousResultsWhileLoading =\s+\(state\.loading === true && state\.loadedGeneration !== state\.searchGeneration\) \|\| state\.error !== null;/u,
  );
});

test('Replace actions stay disabled while the search result is in error', () => {
  assert.match(findTool, /: state\.error !== null\s+\? t\('editor\.findReplaceSearchError'\)/u);
  assert.match(
    findTool,
    /disabled=\{\s+state\.replaceBusy === true \|\|\s+state\.loading === true \|\|\s+state\.error !== null \|\|\s+scopedMatches\.length === 0\s+\}/u,
  );
  assert.match(
    findTool,
    /disabled=\{\s+state\.replaceBusy === true \|\|\s+state\.loading === true \|\|\s+state\.error !== null \|\|\s+activeTextOccurrence === null\s+\}/u,
  );
  assert.match(source, /findReplaceSearchError: '搜索失败，请重试后再替换'/u);
  assert.match(source, /findReplaceSearchError: 'Search failed; retry before replacing'/u);
});
