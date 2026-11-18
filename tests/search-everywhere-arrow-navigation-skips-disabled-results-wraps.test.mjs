import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const findToolWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [searchEverywhereSource, findToolWindowSource, workspaceSource, commitSource].join('\n');

function extract(name) {
  return loadTypeScriptFunction(commitSource, name);
}

test('Search Everywhere arrow navigation skips disabled results and wraps', () => {
  const next = extract('nextEnabledSearchResultIndex');
  const rows = [
    { disabled: false },
    { disabled: true },
    { disabled: false },
    { disabled: true },
  ];
  assert.equal(next(rows, 0, 1), 2);
  assert.equal(next(rows, 2, 1), 0);
  assert.equal(next(rows, 0, -1), 2);
  assert.equal(next([{ disabled: true }, { disabled: true }], 0, 1), null);
  assert.equal(next([], 0, 1), null);
});

test('disabled actions expose a reason and cannot be activated', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  const actions = workspaceSource.slice(
    workspaceSource.indexOf('const searchEverywhereActions ='),
    workspaceSource.indexOf('/* Recompute match count'),
  );
  assert.match(actions, /disabledReason: !hasEditorModel \? t\('editor\.findEditorRequired'\) : t\('editor\.findStepInactive'\)/);
  assert.match(dialog, /nextEnabledSearchResultIndex\(results, activeIndex, direction\)/);
  assert.match(dialog, /moveSearchSelection\(1\)/);
  assert.match(dialog, /moveSearchSelection\(-1\)/);
  assert.match(source, /function searchEverywhereResultTooltip\(result\)/);
  assert.match(source, /result\.disabledReason \?\?/);
  assert.match(dialog, /if \(result === null \|\| result\.disabled === true\) return/);
});

test('action filters do not bypass recent-command ranking', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  const ranking = dialog.indexOf('rankSearchActions(actions, effectiveQuery, recentCommands, {');
  const filter = dialog.indexOf('searchFilters.actions ? actionMatches.slice(0, 12)');
  assert.ok(ranking > 0 && filter > ranking);
});
