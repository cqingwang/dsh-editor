import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const parityUrl = new URL('../docs/search-everywhere-parity.md', import.meta.url);

test('the final ActionsBundle parity matrix is versioned with the plugin', async () => {
  const parity = await readFile(parityUrl, 'utf8');
  assert.match(parity, /IDEA 2026\.2/);
  assert.match(parity, /Search Everywhere/);
  assert.match(parity, /ActionsBundle/);
  assert.match(parity, /ShowSearchEverywhereItemInfo/);
  assert.match(parity, /findUsagesSettings/);
});

test('every exposed search Action maps to a concrete DSH action id', async () => {
  const parity = await readFile(parityUrl, 'utf8');
  for (const [ideaId, dshId] of [
    ['Find', 'find'],
    ['Replace', 'replace'],
    ['FindNext', 'findNext'],
    ['FindPrevious', 'findPrevious'],
    ['FindWordAtCaret', 'findNextWordOccurrence'],
    ['FindPrevWordAtCaret', 'findPreviousWordOccurrence'],
    ['ToggleFindInSelection', 'searchInSelectionOnly'],
    ['IncrementalSearch', 'incrementalSearch'],
    ['FindUsages', 'findUsages'],
    ['ShowSettingsAndFindUsages', 'findUsagesSettings'],
    ['FindUsagesInFile', 'findUsagesInFile'],
    ['FindInPath', 'findInFiles'],
    ['ReplaceInPath', 'replaceInFiles'],
    ['SearchEverywhere', 'searchEverywhere'],
    ['ShowSearchHistory', 'showSearchHistory'],
    ['UsageView.ShowRecentFindUsages', 'recentFindUsages'],
    ['Vcs.Diff.ToggleSearchInChanges', 'searchInChanges'],
    ['StructuralSearchPlugin.StructuralSearchAction', 'structuralSearch'],
    ['StructuralSearchPlugin.StructuralReplaceAction', 'structuralReplace'],
    ['ActivateFindToolWindow', 'findToolWindow'],
    ['FindSelectionInPath', 'findSelectionInFiles'],
    ['TextSearchAction', 'textSearch'],
  ]) {
    assert.ok(parity.includes(ideaId), `parity matrix is missing ${ideaId}`);
    assert.ok(parity.includes(dshId), `parity matrix is missing ${dshId}`);
    assert.ok(source.includes(`id: '${dshId}'`), `source is missing ${dshId}`);
  }
});

test('internal Search Everywhere actions remain behavior, not fake Action rows', async () => {
  const parity = await readFile(parityUrl, 'utf8');
  for (const internalId of [
    'SearchEverywhere.NextTab',
    'SearchEverywhere.PrevTab',
    'SearchEverywhere.CompleteCommand',
    'SearchEverywhere.SelectItem',
    'SearchEverywhere.NavigateToNextGroup',
    'SearchEverywhere.NavigateToPrevGroup',
    'ShowSearchEverywhereItemInfo',
  ]) {
    assert.ok(parity.includes(internalId), `parity matrix is missing ${internalId}`);
  }
  assert.match(source, /searchEverywhereGroupNavigationDirection\(/);
  assert.doesNotMatch(source, /searchEverywhereProviderCompletion\(/);
  assert.match(source, /const activateResult = \(result\) =>/);
  assert.match(source, /function searchEverywhereItemInfo\(/);
});

test('language-dependent actions stay either implemented or explicitly disabled', async () => {
  const parity = await readFile(parityUrl, 'utf8');
  assert.match(parity, /Monaco[\s\S]*AST/);
  assert.match(parity, /disabled/);
  assert.match(source, /id: 'structuralSearch'[\s\S]*?disabled: true/);
  assert.match(source, /id: 'structuralReplace'[\s\S]*?disabled: true/);
  assert.match(source, /id: 'findUsagesSettings'[\s\S]*?disabled: true/);
});
