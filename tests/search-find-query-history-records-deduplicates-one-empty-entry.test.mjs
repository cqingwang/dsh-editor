import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [
  searchEverywhereSource,
  workspaceSource,
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  commitSource,
].join('\n');

function extractSourceFunction(name, text = commitSource) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = text.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function rememberFindQueryHistory() {
  return new Function(
    `${transpileTypeScriptFunction(commitSource, 'normalizeFindQueryHistoryEntry')};`
      + `${transpileTypeScriptFunction(commitSource, 'rememberFindQueryHistory')};`
      + 'return rememberFindQueryHistory;',
  )();
}

function rememberReplacementHistory() {
  return new Function(
    `${transpileTypeScriptFunction(commitSource, 'normalizeReplacementHistoryEntry')};`
      + `${transpileTypeScriptFunction(commitSource, 'rememberReplacementHistory')};`
      + 'return rememberReplacementHistory;',
  )();
}

test('Find query history records and deduplicates one empty entry', () => {
  const remember = rememberFindQueryHistory();
  assert.deepEqual(remember(['old'], '', 20), ['', 'old']);
  assert.deepEqual(remember(['', 'old'], 'old', 20), ['old', '']);
  assert.deepEqual(remember(['', 'old'], undefined, 20), ['', 'old']);
  assert.deepEqual(remember([null, 7, '', 'old'], undefined, 20), ['', 'old']);
});

test('Replacement history records and deduplicates one empty entry', () => {
  const remember = rememberReplacementHistory();
  assert.deepEqual(remember(['old'], '', 20), ['', 'old']);
  assert.deepEqual(remember(['', 'old'], 'old', 20), ['old', '']);
  assert.deepEqual(remember(['', 'old'], undefined, 20), ['', 'old']);
  assert.deepEqual(remember([null, 7, '', 'old'], undefined, 20), ['', 'old']);
});

test('Workspace recorders accept empty query and replacement without trimming', () => {
  const findRecorder = extractSourceFunction('rememberWorkspaceFindQuery');
  const replacementRecorder = extractSourceFunction('rememberWorkspaceReplacement');
  assert.match(findRecorder, /typeof query !== 'string'/u);
  assert.doesNotMatch(findRecorder, /query === ''/u);
  assert.match(replacementRecorder, /typeof replacement !== 'string'/u);
  assert.doesNotMatch(replacementRecorder, /replacement === ''/u);
});

test('Reading and writing history does not append a synthetic blank entry', () => {
  const findRead = extractSourceFunction('readFindQueryHistory', source);
  const findWrite = extractSourceFunction('writeFindQueryHistory', source);
  const replaceRead = extractSourceFunction('readReplaceHistory', source);
  const replaceWrite = extractSourceFunction('writeReplaceHistory', source);
  const findWriteTail = source.slice(
    source.indexOf('function writeFindQueryHistory('),
    source.indexOf('/** Per-workspace Find Usages history key. */'),
  );
  const replaceWriteTail = source.slice(
    source.indexOf('function writeReplaceHistory('),
    source.indexOf('/**\n     * Record one successful query for a workspace.'),
  );
  for (const block of [findRead, findWriteTail, replaceRead, replaceWriteTail]) {
    assert.match(block, /,\s+undefined,\s+20\)/u);
  }
});

test('Find and replacement history menus replay blank entries through their owners', () => {
  const findTool = source.slice(
    source.lastIndexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
  );
  assert.match(findTool, /if \(kind === 'query'\) onQuery\(value\);\s+else onReplace\(value\);/u);
  assert.match(findTool, /label: value,/u);

  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
  );
  assert.match(searchEverywhere, /onReplaceChange\(value\);/u);
  assert.match(searchEverywhere, /label: value,/u);
});

test('History replay returns keyboard ownership to the replayed field', () => {
  const findTool = source.slice(
    source.lastIndexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
  );
  assert.match(findTool, /kind === 'query' \? queryInputRef\.current : \(replaceInputRef\.current \?\? queryInputRef\.current\)/u);
  assert.match(findTool, /input\?\.focus\?\.\(\)/u);

  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
  );
  assert.match(searchEverywhere, /onQuery\(value\);\s+window\.setTimeout\(\(\) => searchInputRef\.current\?\.focus\?\.\(\), 0\)/u);
  assert.match(searchEverywhere, /onReplaceChange\(value\);\s+window\.setTimeout\(\(\) => replaceInputRef\.current\?\.focus\?\.\(\), 0\)/u);

  assert.match(source, /'\[data-dsh-editor-find-input\]'\s+: '\[data-dsh-editor-find-replace-input\]'/u);
  assert.match(source, /document\.querySelector(?:<[^>]+>)?\(selector\)\?\.focus\?\.\(\)/u);
});
