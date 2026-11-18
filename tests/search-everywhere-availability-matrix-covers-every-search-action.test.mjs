import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);
const matches = [...actions.matchAll(/id: '([^']+)'/g)];
const blocks = new Map(matches.map((match, index) => [
  match[1],
  actions.slice(match.index, matches[index + 1]?.index ?? actions.length),
]));

test('Search Everywhere availability matrix covers every search action', () => {
  assert.equal(blocks.size, 33);
});

test('editor-only actions are disabled only by editor availability', () => {
  for (const id of ['find', 'replace', 'incrementalSearch']) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.match(block, /disabled: !hasEditorModel/);
    assert.match(block, /disabledReason: t\('editor\.findEditorRequired'\)/);
  }
});

test('selection-only actions are disabled without a selection scope', () => {
  for (const id of ['searchInSelectionOnly', 'replaceInSelectionOnly']) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.match(block, /disabled: !hasSelectionScope/);
    assert.match(block, /editor\.findSelectionRequired/);
    assert.match(block, /editor\.findEditorRequired/);
  }
});

test('symbol actions share the selection-or-caret availability boundary', () => {
  for (const id of [
    'findSelectionInFiles',
    'replaceSelectionInFiles',
    'findUsages',
    'showUsages',
    'findUsagesInFile',
    'highlightUsagesInFile',
    'searchWeb',
    'findNextWordOccurrence',
    'findPreviousWordOccurrence',
    'selectAllOccurrences',
    'selectNextOccurrence',
    'unselectPreviousOccurrence',
  ]) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.match(block, /disabled: findUsagesTarget\.query === ''/);
    assert.match(block, /editor\.findEditorRequired/);
    assert.match(block, /editor\.findUsagesSymbolRequired/);
  }
});

test('find-step actions require an active editor query', () => {
  for (const id of ['findNext', 'findPrevious']) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.match(block, /disabled: !hasEditorModel \|\| replaceState === null \|\| replaceState\.find === ''/);
    assert.match(block, /editor\.findStepInactive/);
  }
});

test('Search In Changes requires an active visible diff', () => {
  const block = blocks.get('searchInChanges');
  assert.ok(block, 'searchInChanges missing');
  assert.match(block, /disabled: diffOpen === false/);
  assert.match(block, /editor\.searchInChangesUnavailable/);
});

test('structural actions stay disabled and workspace actions stay available', () => {
  for (const id of ['structuralSearch', 'structuralReplace', 'findUsagesSettings']) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.match(block, /disabled: true/);
    assert.match(block, /disabledReason: t\('editor\./);
  }
  for (const id of [
    'goToFile',
    'recentFiles',
    'searchEverywhere',
    'textSearch',
    'findAction',
    'showSearchHistory',
    'recentFindUsages',
    'findToolWindow',
    'findInFiles',
    'replaceInFiles',
  ]) {
    const block = blocks.get(id);
    assert.ok(block, `${id} missing`);
    assert.doesNotMatch(block, /disabled:/);
  }
});
