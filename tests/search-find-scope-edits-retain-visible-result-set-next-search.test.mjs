import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find scope edits retain the visible result set while the next search starts', () => {
  const start = source.indexOf('const changeFindToolScope = React.useCallback');
  const end = source.indexOf('}, []);', start);
  const scopeChange = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(scopeChange, /files: current\.files/u);
  assert.match(scopeChange, /matches: current\.matches/u);
  assert.match(scopeChange, /index: current\.index/u);
  assert.match(scopeChange, /const hasQuery = hasFindToolContentQuery\(current\.query\)/u);
  assert.match(scopeChange, /loading: hasQuery/u);
  assert.doesNotMatch(scopeChange, /files: \[\]/u);
  assert.doesNotMatch(scopeChange, /matches: \[\]/u);
});

test('A new Find search generation preserves results instead of blanking them', () => {
  assert.doesNotMatch(
    source,
    /current === null\s*\? current\s*: \{ \.\.\.current, files: \[\], loading: true, error: null \}/u,
    'the startup path must not clear files while loading',
  );
  assert.match(
    source,
    /setFindTool\(\(current\) => \(current === null\s+\? current\s+: \{ \.\.\.current, loading: true, error: null \}\)\);/u,
  );
});

test('Loading is reported in the header and only fills an otherwise empty list', () => {
  assert.match(
    findTool,
    /state\.loading === true\s+\? t\('editor\.loading'\)\s+: fileFilterMode\s+\? t\('editor\.searchResultCount'[\s\S]{0,180}findToolResultSummary\(t, resultMatches, resultFiles\)/u,
  );
  assert.match(findTool, /state\.loading === true && occurrences\.length === 0/u);
});

test('Scope filtering waits for the new generation instead of hiding retained rows immediately', () => {
  assert.match(
    findTool,
    /const retainPreviousResultsWhileLoading =\s+\(state\.loading === true && state\.loadedGeneration !== state\.searchGeneration\) \|\| state\.error !== null;/u,
  );
  assert.match(
    findTool,
    /const scopedFileResults = React\.useMemo\(\s+\(\) =>\s+retainPreviousResultsWhileLoading\s+\? fileResults\s+: fileResults\.filter/u,
  );
  assert.match(
    findTool,
    /const scopedMatches = React\.useMemo\(\s+\(\) =>\s+retainPreviousResultsWhileLoading\s+\? textResults\s+: textResults\.filter/u,
  );
});

test('Retained rows cannot be replaced before the new scope generation finishes', () => {
  assert.match(findTool, /const replaceDisabledReasons = findReplaceDisabledReasons\(\{/u);
  assert.match(findTool, /loading: state\.loading/u);
  assert.match(
    findTool,
    /disabled=\{\s+state\.replaceBusy === true \|\|\s+state\.loading === true \|\|\s+state\.error !== null \|\|\s+scopedMatches\.length === 0 \|\|\s+!findToolResultsAreCurrent\(state\)\s+\}/u,
  );
  assert.match(findTool, /scopedMatches\.length === 0 \|\|\s+!findToolResultsAreCurrent\(state\)/u);
  assert.match(findTool, /!findToolResultsAreCurrent\(state\)\s+\? 0\.45\s+: 1/u);
});
