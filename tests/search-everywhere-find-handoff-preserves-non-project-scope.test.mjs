import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8')));

test('Search Everywhere to Find handoff preserves non-project scope', () => {
  const handoff = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereRequiresResultConfirmation')}; ${transpileTypeScriptFunction(commitSource, 'searchFindHandoff')}; return searchFindHandoff;`,
  )();
  const result = handoff({
    query: 'needle',
    files: [],
    matches: [{ path: 'node_modules/pkg/a.js', line: 1, column: 1 }],
    includeExcluded: true,
  });
  assert.equal(result.request.includeExcluded, true);
  assert.match(source, /includeExcluded: state\.includeNonProject === true/);
});

test('persistent Find exposes the same non-project scope and forwards it while searching', () => {
  const findWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findWindow, /id: 'include'/);
  assert.match(findWindow, /label: t\('editor\.includeNonProjectItems'\)/);
  assert.match(findWindow, /active: state\.includeExcluded === true/);
  assert.match(findWindow, /onClick: onToggleIncludeExcluded/);
  assert.match(source, /includeExcluded: findTool\?\.includeExcluded === true/);
});

test('Find opens with the handed-off non-project scope and resets results when toggled', () => {
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const openShowUsages = React.useCallback'),
  );
  assert.match(openFind, /includeExcluded: initial !== null/);
  assert.match(openFind, /\? initial\.includeExcluded === true/);
  assert.match(openFind, /: savedOptions\.includeExcluded === true/);
  assert.match(source, /onToggleIncludeExcluded=\{\(\) =>\s*setFindTool/);
  const toggle = source.slice(
    source.indexOf('onToggleIncludeExcluded={() =>'),
    source.indexOf('onFileMaskChange={', source.indexOf('onToggleIncludeExcluded={() =>')),
  );
  assert.match(toggle, /includeExcluded: current\.includeExcluded !== true/);
  assert.match(toggle, /files: \[\]/);
  assert.match(toggle, /matches: \[\]/);
  assert.match(toggle, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
});

test('blank Replace in Files carries the current non-project scope', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function SearchEverywhere(') + source.length,
  );
  assert.match(searchEverywhere, /includeExcluded: state\.includeNonProject === true/);
  assert.match(searchEverywhere, /preserveCase: state\.preserveCase === true/);
});
