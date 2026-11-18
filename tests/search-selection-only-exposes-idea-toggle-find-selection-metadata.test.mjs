import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = workspaceSource.indexOf('const searchEverywhereActions =');
const actionsEnd = workspaceSource.indexOf('/* Recompute match count', actionsStart);
const actions = workspaceSource.slice(actionsStart, actionsEnd);

function loadRanker() {
  const functions = ['wholeWordIndex', 'fuzzyScore']
    .map((name) => transpileTypeScriptFunction(findToolSource, name))
    .join('\n');
  return new Function(
    'basename',
    `${functions}\n${transpileTypeScriptFunction(commitSource, 'rankSearchActions')}\nreturn rankSearchActions;`,
  )((path) => path.split('/').at(-1));
}

test('Search in Selection Only exposes IDEA Toggle Find in Selection metadata', () => {
  const start = actions.indexOf("id: 'searchInSelectionOnly'");
  const end = actions.indexOf("id: 'replaceInSelectionOnly'", start);
  const action = actions.slice(start, end);
  assert.match(action, /shortcut: '⌃⌥E'/);
  assert.match(action, /keywords: t\('editor\.toggleFindInSelectionSynonym'\)/);
});

test('Toggle Find in Selection synonym ranks the existing scoped action first', () => {
  const rank = loadRanker();
  const ranked = rank([
    {
      id: 'searchInSelectionOnly',
      label: 'Search in Selection Only',
      description: 'Search in Selection Only',
      keywords: 'Toggle Find in Selection',
    },
    {
      id: 'replaceInSelectionOnly',
      label: 'Replace in Selection Only',
      description: 'Replace in Selection Only',
      keywords: 'Replace in Selection',
    },
  ], 'Toggle Find in Selection', []);
  assert.equal(ranked[0]?.id, 'searchInSelectionOnly');
});

test('Toggle Find in Selection synonym is localized', () => {
  assert.match(source, /toggleFindInSelectionSynonym: '切换仅在选区内查找'/);
  assert.match(source, /toggleFindInSelectionSynonym: 'Toggle Find in Selection'/);
});

test('the visible shortcut normalizes to Control+Alt+E metadata', () => {
  const normalize = new Function(
    `${transpileTypeScriptFunction(commitSource, 'searchEverywhereAriaKeyShortcuts')}; return searchEverywhereAriaKeyShortcuts;`,
  )();
  assert.equal(normalize('⌃⌥E'), 'Control+Alt+E');
});
