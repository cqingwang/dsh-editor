import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('A failed Find search retains the previous rows instead of clearing them', () => {
  const effectStart = source.indexOf('React.useEffect(() => {\n        if (!findToolOpen');
  const effectEnd = source.indexOf('      }, [\n        findToolOpen,', effectStart);
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
  assert.match(findTool, /const findResultStatus = state\.error !== null\s+\? ''\s+: state\.loading === true/u);
  assert.match(findTool, /const retainPreviousResultsWhileLoading = state\.loading === true\s+&& state\.loadedGeneration !== state\.searchGeneration\s+\|\| state\.error !== null/u);
});

test('Replace actions stay disabled while the search result is in error', () => {
  assert.match(findTool, /: state\.error !== null\s+\? t\('editor\.findReplaceSearchError'\)/u);
  assert.match(findTool, /disabled: state\.replaceBusy === true \|\| state\.loading === true \|\| state\.error !== null \|\| scopedMatches\.length === 0/u);
  assert.match(findTool, /disabled: state\.replaceBusy === true \|\| state\.loading === true \|\| state\.error !== null \|\| active\?\.kind !== 'text'/u);
  assert.match(source, /findReplaceSearchError: '搜索失败，请重试后再替换'/u);
  assert.match(source, /findReplaceSearchError: 'Search failed; retry before replacing'/u);
});
