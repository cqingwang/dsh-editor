import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const [commitSource, searchScopeSource, workspaceSource, localesSource] = await Promise.all([
  readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/components/search/search-scope.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
]);
const rules = loadTypeScriptModule(commitSource, [
  'normalizeSearchDirectoryRules',
  'searchDirectoryEffectiveState',
  'searchDirectoryExcludedWithIncludedDescendant',
  'toggleSearchDirectoryRule',
]);
const scopeHelpers = loadTypeScriptModule(`${commitSource}\n${searchScopeSource}`, [
  'findScopePreflight',
  'directoryScopeRequest',
  'invalidFindDirectoryScopePath',
]);

test('an excluded Directory scope is distinguished from a directory with included children', () => {
  const excluded = rules.toggleSearchDirectoryRule('src', rules.normalizeSearchDirectoryRules(null));
  assert.equal(rules.searchDirectoryEffectiveState('src', excluded), 'excluded');
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src', excluded), false);

  const includedChild = rules.toggleSearchDirectoryRule('src/keep', excluded);
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src', includedChild), true);
});

test('Find reports an excluded Directory scope before requesting the host', () => {
  assert.match(workspaceSource, /findToolDirectoryExcluded/u);
  assert.match(workspaceSource, /findScopePreflight\(findTool, \{/u);
  assert.match(workspaceSource, /setFindTool\(preflight\.state\)/u);
  assert.match(localesSource, /findToolDirectoryExcluded: '搜索目录已排除：\{path\}'/u);
  assert.match(localesSource, /findToolDirectoryExcluded: 'Search directory is excluded: \{path\}'/u);
  const excluded = rules.toggleSearchDirectoryRule('src', rules.normalizeSearchDirectoryRules(null));
  assert.deepEqual(
    scopeHelpers.findScopePreflight(
      { searchGeneration: 3, files: ['stale'], matches: ['stale'] },
      {
        hasQuery: true,
        generation: 3,
        directory: 'src',
        searchDirectoryRules: excluded,
        excludedMessage: (path) => `excluded:${path}`,
        invalidMessage: (path) => `invalid:${path}`,
      },
    ),
    {
      state: {
        searchGeneration: 3,
        files: [],
        matches: [],
        truncated: false,
        loading: false,
        loadedGeneration: 3,
        error: 'excluded:src',
      },
    },
  );
  const includedChild = rules.toggleSearchDirectoryRule('src/keep', excluded);
  assert.equal(
    scopeHelpers.findScopePreflight(
      { searchGeneration: 3 },
      {
        hasQuery: true,
        generation: 3,
        directory: 'src',
        searchDirectoryRules: includedChild,
        excludedMessage: () => 'excluded',
        invalidMessage: () => 'invalid',
      },
    ),
    null,
  );
  assert.equal(scopeHelpers.invalidFindDirectoryScopePath('../outside'), true);
  assert.equal(scopeHelpers.invalidFindDirectoryScopePath('/tmp/outside'), true);
  assert.equal(scopeHelpers.invalidFindDirectoryScopePath('src//nested'), true);
  assert.equal(scopeHelpers.invalidFindDirectoryScopePath('src/nested'), false);
  assert.deepEqual(
    scopeHelpers.directoryScopeRequest(
      { mode: 'project', preset: 'projectFiles', directory: '' },
      { mode: 'directory', preset: 'projectFiles', directory: '../outside' },
    ),
    { mode: 'directory', preset: 'projectFiles', directory: '../outside' },
  );
  assert.deepEqual(
    scopeHelpers.findScopePreflight(
      { searchGeneration: 3, files: ['stale'] },
      {
        hasQuery: true,
        generation: 3,
        directory: '../outside',
        searchDirectoryRules: rules.normalizeSearchDirectoryRules(null),
        excludedMessage: () => 'excluded',
        invalidMessage: (path) => `invalid:${path}`,
      },
    ),
    {
      state: {
        searchGeneration: 3,
        files: [],
        matches: [],
        truncated: false,
        loading: false,
        loadedGeneration: 3,
        error: 'invalid:../outside',
      },
    },
  );
  assert.deepEqual(
    scopeHelpers.findScopePreflight(
      { searchGeneration: 4, files: ['stale'], matches: ['stale'], error: 'old directory error' },
      {
        hasQuery: false,
        generation: 4,
        directory: '../outside',
        searchDirectoryRules: rules.normalizeSearchDirectoryRules(null),
        excludedMessage: () => 'excluded',
        invalidMessage: () => 'invalid',
      },
    ),
    {
      state: {
        searchGeneration: 4,
        files: [],
        matches: [],
        truncated: false,
        loading: false,
        loadedGeneration: 4,
        error: null,
      },
    },
  );
});
