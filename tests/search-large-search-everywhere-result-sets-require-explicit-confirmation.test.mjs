import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'));

function extract(name) {
  return new Function(`${transpileTypeScriptFunction(source, name)}; return ${name};`)();
}

test('large Search Everywhere result sets require explicit confirmation', () => {
  const requires = extract('searchEverywhereRequiresResultConfirmation');
  assert.equal(requires([], [], 200), false);
  assert.equal(requires(Array(200).fill('a'), [], 200), false);
  assert.equal(requires(Array(201).fill('a'), [], 200), true);
  assert.equal(requires(Array(80).fill('a'), Array(121).fill({}), 200), true);
});

test('Open in Find Tool Window confirms oversized result sets', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const request = searchFindHandoff\(\{/);
  assert.match(dialog, /request\.needsConfirmation &&\s+!window\.confirm\(\s+t\('editor\.searchTooManyResults'/u);
  assert.match(dialog, /count: request\.total/);
});

test('Search Everywhere exposes IDEA find-next and find-previous actions', () => {
  const actions = source.slice(source.indexOf('const searchEverywhereActions ='), source.indexOf('/* Recompute match count'));
  assert.match(actions, /id: 'findNext'/);
  assert.match(actions, /id: 'findPrevious'/);
  assert.match(actions, /shortcut: '⌘G'/);
  assert.match(actions, /shortcut: '⇧⌘G'/);
  assert.match(actions, /editorFindStepRef\.current\?\.\(1\)/);
  assert.match(actions, /editorFindStepRef\.current\?\.\(-1\)/);
  assert.match(source, /editorFindStepRef\.current = jumpToMatch/);
});
