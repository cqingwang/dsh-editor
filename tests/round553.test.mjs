import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

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
  const disabled = (actions.match(/disabled: /g) ?? []).length;
  const reasons = (actions.match(/disabledReason:/g) ?? []).length;
  assert.ok(disabled > 0);
  assert.equal(reasons, disabled);
});

test('all Search Everywhere action copy resolves in both dictionaries', () => {
  const zhStart = source.indexOf('    const zh = {');
  const enStart = source.indexOf('    const en = {', zhStart);
  const zhEnd = source.indexOf('\n    };', zhStart);
  const enEnd = source.indexOf('\n    };', enStart);
  const keys = new Set(
    [...actions.matchAll(/t\('editor\.([A-Za-z0-9_]+)'/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    assert.match(source.slice(zhStart, zhEnd), new RegExp(`\\b${key}: '`), `zh is missing ${key}`);
    assert.match(source.slice(enStart, enEnd), new RegExp(`\\b${key}: '`), `en is missing ${key}`);
  }
});
