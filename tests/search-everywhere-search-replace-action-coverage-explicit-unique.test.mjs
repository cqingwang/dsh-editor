import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, zh } from './locale-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);
const zhKeys = new Set(Object.keys(zh.editor));
const enKeys = new Set(Object.keys(en.editor));

const expectedActionIds = [
  'searchEverywhere',
  'goToFile',
  'recentFiles',
  'textSearch',
  'findAction',
  'showSearchHistory',
  'recentFindUsages',
  'find',
  'findToolWindow',
  'replace',
  'structuralSearch',
  'structuralReplace',
  'incrementalSearch',
  'searchInSelectionOnly',
  'replaceInSelectionOnly',
  'findSelectionInFiles',
  'replaceSelectionInFiles',
  'findUsages',
  'showUsages',
  'findUsagesSettings',
  'findUsagesInFile',
  'highlightUsagesInFile',
  'searchWeb',
  'findNextWordOccurrence',
  'findPreviousWordOccurrence',
  'selectAllOccurrences',
  'selectNextOccurrence',
  'unselectPreviousOccurrence',
  'findNext',
  'findPrevious',
  'searchInChanges',
  'findInFiles',
  'replaceInFiles',
];

test('Search Everywhere search/replace action coverage is explicit and unique', () => {
  const ids = [...actions.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, expectedActionIds.length);
  assert.equal(new Set(ids).size, ids.length, 'action ids must be unique');
  assert.deepEqual([...ids].sort(), [...expectedActionIds].sort());
});

test('every Search Everywhere action has a visible identity', () => {
  assert.equal((actions.match(/id: '/g) ?? []).length, expectedActionIds.length);
  assert.equal((actions.match(/label: t\('/g) ?? []).length, expectedActionIds.length);
  assert.equal((actions.match(/description: t\('/g) ?? []).length, expectedActionIds.length);
});

test('every disabled Search Everywhere action carries a concrete reason', () => {
  const disabled = (actions.match(/disabled:\s*/g) ?? []).length;
  const reasons = (actions.match(/disabledReason:/g) ?? []).length;
  assert.ok(disabled > 0);
  assert.equal(reasons, disabled);
});

test('all Search Everywhere action copy resolves in both dictionaries', () => {
  const keys = new Set(
    [...actions.matchAll(/t\('editor\.([A-Za-z0-9_]+)'/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    assert.ok(zhKeys.has(key), `zh is missing ${key}`);
    assert.ok(enKeys.has(key), `en is missing ${key}`);
  }
});
