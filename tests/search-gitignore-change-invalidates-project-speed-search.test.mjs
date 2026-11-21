import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const searchScopeSource = await readFile(
  new URL('../src/client/components/search/search-scope.ts', import.meta.url),
  'utf8',
);
const searchScope = loadTypeScriptModule(searchScopeSource, [
  'searchScopeRevisionChanged',
  'searchEverywhereAfterSearchScopeChange',
  'findToolAfterSearchScopeChange',
]);
const { workspaceChangeInvalidatesSearchScope } = loadTypeScriptModule(commitSource, [
  'workspaceChangeInvalidatesSearchScope',
]);

test('Git ignore rule changes invalidate an active Project speed search', () => {
  assert.equal(workspaceChangeInvalidatesSearchScope(['.gitignore']), true);
  assert.equal(workspaceChangeInvalidatesSearchScope(['docs/.gitignore']), true);
  assert.equal(workspaceChangeInvalidatesSearchScope(['.git/info/exclude']), true);
  assert.equal(workspaceChangeInvalidatesSearchScope(['.git/index']), true);
  assert.equal(workspaceChangeInvalidatesSearchScope(['src/client/app.ts']), false);
  assert.equal(workspaceChangeInvalidatesSearchScope(null), false);
});

test('the Project speed-search effect follows the Git scope revision', () => {
  assert.match(panelSource, /searchRevision: number/u);
  assert.match(panelSource, /searchDirectoryRules,\s*searchRevision,/u);
  assert.match(workspaceSource, /workspaceChangeInvalidatesSearchScope\(event\.paths\)/u);
  assert.match(workspaceSource, /<ProjectPanel[\s\S]*?searchRevision=\{searchRevision\}/u);
});

test('open Search Everywhere and Find surfaces invalidate their scoped data', () => {
  assert.match(workspaceSource, /useSearchInvalidation\(\{/u);
  assert.match(searchScopeSource, /requestFiles\(searchEverywhere\.includeNonProject === true\)/u);
  assert.match(searchScopeSource, /useSearchInvalidation/u);
  assert.match(
    workspaceSource,
    /findTool\?\.includeExcluded,[\s\S]*?findTool\?\.fileMask,[\s\S]*?searchRevision,\s*searchDirectoryRules,/u,
  );
  const searchEverywhere = searchScope.searchEverywhereAfterSearchScopeChange({
    files: [{ path: 'stale.ts' }],
    filesScope: true,
    filesTruncated: true,
    textMatches: [{ path: 'stale.ts' }],
    textLoading: true,
    textTruncated: true,
    textRevision: 4,
    error: 'stale',
    errorSource: 'text',
  });
  assert.deepEqual(searchEverywhere, {
    files: [],
    filesScope: undefined,
    filesTruncated: false,
    textMatches: [],
    textLoading: false,
    textTruncated: false,
    textRevision: 5,
    error: null,
    errorSource: null,
  });
  const findTool = searchScope.findToolAfterSearchScopeChange({
    searchGeneration: 7,
    loadedGeneration: 7,
    error: 'stale',
  });
  assert.deepEqual(findTool, { searchGeneration: 8, loadedGeneration: 7, error: null });
  assert.equal(
    searchScope.searchScopeRevisionChanged(
      { searchRevision: 2, searchDirectoryRules: { excludedDirectories: [] } },
      2,
      { excludedDirectories: [] },
    ),
    true,
  );
});
