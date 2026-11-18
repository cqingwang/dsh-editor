import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'));
const actions = source.slice(source.indexOf('const searchEverywhereActions ='), source.indexOf('/* Recompute match count'));

test('Search Everywhere Actions open Find in Files with a content query, not the action filter', () => {
  const find = actions.slice(actions.indexOf("id: 'findInFiles'"), actions.indexOf("id: 'replaceInFiles'"));
  const replace = actions.slice(actions.indexOf("id: 'replaceInFiles'"), actions.indexOf('], [', actions.indexOf("id: 'replaceInFiles'")));
  assert.match(find, /run: \(\) => openFindTool\('', 'find'\)/);
  assert.match(replace, /run: \(\) => openFindTool\('', 'replace'\)/);
  assert.doesNotMatch(find, /searchEverywhere\?\.query/);
  assert.doesNotMatch(replace, /searchEverywhere\?\.query/);
});

test('content-result handoff still owns query preservation', () => {
  const component = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(component, /const request = searchFindHandoff\(\{\s*query: effectiveQuery,/);
  assert.match(component, /activeRowKey: \(result \?\? activeResult\)\?\.rowKey/);
  assert.match(component, /onReplace: \(\) => openSearchResultsInFind\('replace', result\)/);
});

test('the Actions dependency no longer captures the action-filter query', () => {
  const dependencyTail = actions.slice(actions.lastIndexOf('], ['));
  assert.doesNotMatch(dependencyTail, /searchEverywhere\?\.query/);
});
