import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const dividerSource = await readFile(
  new URL('../src/client/components/editor/EditorSplitDivider.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Search Everywhere results and preview split is bounded and persisted', () => {
  const { clampSearchEverywhereResultsPercent: clamp } = loadTypeScriptModule(findToolSource, [
    'clampSearchEverywhereResultsPercent',
  ]);
  assert.equal(clamp(Number.NaN), 42);
  assert.equal(clamp(5), 20);
  assert.equal(clamp(95), 80);
  assert.equal(Math.round(clamp(5, 300)), 37);
  assert.equal(Math.round(clamp(95, 300)), 63);

  assert.match(
    searchEverywhereSource,
    /SEARCH_EVERYWHERE_RESULTS_PERCENT_STORAGE_KEY = 'dsh-editor\.searchEverywhere\.resultsPercent'/u,
  );
  assert.match(searchEverywhereSource, /<EditorSplitDivider[\s\S]*?orientation='horizontal'/u);
  assert.match(searchEverywhereSource, /writeStoredNumber\(SEARCH_EVERYWHERE_RESULTS_PERCENT_STORAGE_KEY/u);
  assert.match(searchEverywhereSource, /searchEverywhereResultsPercent/u);
  assert.match(searchEverywhereSource, /onMouseEnter=\{\(event\) => \{\s+if \(resultsDragging\) return;/u);
  assert.match(dividerSource, /orientation = 'vertical'/u);
  assert.match(dividerSource, /orientation === 'horizontal' \? 'horizontal' : 'vertical'/u);
});

test('text match activation carries the searched range into Monaco', () => {
  const { findToolTextMatchLength } = loadTypeScriptModule(findToolSource, ['findToolTextMatchLength']);
  assert.equal(findToolTextMatchLength({ preview: 'const activityThread = 1;', column: 7 }, 'activityThread'), 14);
  assert.equal(
    findToolTextMatchLength(
      { preview: 'id = 12345 // id', column: 1 },
      'id\\s*=\\s*\\d+',
      { regex: true },
    ),
    10,
  );

  assert.match(
    workspaceSource,
    /openFileAtLocation\(result\.path, result\.line, result\.column, \{[\s\S]*?endColumn:[\s\S]*?findToolTextMatchLength/u,
  );
  assert.match(
    workspaceSource,
    /editor\.setSelection\(new window\.monaco\.Range\(safeLine, safeColumn, safeEndLine, safeEndColumn\)\)/u,
  );
  assert.match(workspaceSource, /editor\.revealLineInCenter\(safeLine\)/u);
});
