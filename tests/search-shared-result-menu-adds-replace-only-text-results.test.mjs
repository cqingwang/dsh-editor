import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8')));

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('shared result menu adds Replace only for text results', () => {
  const helper = source.slice(
    source.indexOf('function searchResultContextItems('),
    source.indexOf('function searchEverywhereOptionId('),
  );
  assert.match(helper, /onReplace/);
  assert.match(helper, /result\.kind === 'text'/);
  assert.match(helper, /id: 'replace'/);
  assert.match(helper, /t\('editor\.replaceAction'\)/);
});

test('Search Everywhere header and text menu share one Find handoff', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  const handoff = source.slice(source.indexOf('function searchFindHandoff('), source.indexOf('function searchHistoryStorageKey('));
  assert.match(dialog, /const openSearchResultsInFind = \(mode = null, result = null, \{ refresh = false \} = \{\}\) =>/);
  assert.match(dialog, /const request = searchFindHandoff\(\{/);
  assert.match(handoff, /mode: mode === 'replace' \|\| withReplace === true \? 'replace' : 'find'/);
  assert.match(dialog, /onClick: \(\) => openSearchResultsInFind\(null, activeResult\)/);
  assert.match(dialog, /onReplace: \(\) => openSearchResultsInFind\('replace', result\)/);
  assert.match(dialog, /onOpenInFindToolWindow\(refresh === true \? \{ \.\.\.request\.request, refresh: true \} : request\.request\)/);
});

test('Find Replace action switches mode without dropping results', () => {
  const panel = source.slice(source.indexOf('function FindToolWindow('), source.indexOf('/* QUICK_OPEN_BOUNDARY */'));
  assert.match(panel, /onReplaceMode/);
  assert.match(panel, /const replaceInputRef = React\.useRef\(null\)/);
  assert.match(panel, /const replaceFocusPendingRef = React\.useRef\(false\)/);
  assert.match(panel, /const focusReplaceInput = \(\) =>/);
  assert.match(panel, /ref: replaceInputRef/);
  assert.match(panel, /onReplace: \(\) => focusReplaceInput\(\)/);
  assert.doesNotMatch(panel, /onReplace: \(\) => \{[\s\S]{0,120}setCollapsedFiles/);
});

test('Editor wires Find replace mode to the existing state without resetting results', () => {
  const start = source.indexOf('React.createElement(FindToolWindow');
  assert.notEqual(start, -1);
  const render = source.slice(start, start + 14000);
  assert.match(render, /onReplaceMode: \(\) => setFindTool\(\(current\) => current === null \? current : \{ \.\.\.current, mode: 'replace' \}\)/);
  assert.doesNotMatch(render, /onReplaceMode: \(\) => setFindTool\(\{/);
});
