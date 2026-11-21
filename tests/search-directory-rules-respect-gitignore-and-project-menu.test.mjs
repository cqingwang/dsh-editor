import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const findToolSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, [
  'normalizeSearchDirectoryRules',
  'searchDirectoryEffectiveState',
  'searchDirectoryExcludedWithIncludedDescendant',
  'searchPathAllowedByDirectoryRules',
  'toggleSearchDirectoryRule',
  'remapSearchDirectoryRulesAfterMove',
  'pruneSearchDirectoryRulesAfterDelete',
  'rerunFindToolAfterWorkspaceDelete',
  'workspaceChangeHasMissingPath',
  'invalidateFindAfterExternalDelete',
  'pruneFindCollapsedFiles',
  'findShouldRestoreFocusAfterResultsChange',
  'findFocusShouldReleaseOutsideSurface',
  'confirmFindReplaceAndGeneration',
]);

async function createSearchFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-directory-rules-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-dir/\nignored-file.txt\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'SEARCH_RULE_NEEDLE visible\n', 'utf8');
  await mkdir(join(root, 'ignored-dir'), { recursive: true });
  await writeFile(join(root, 'ignored-dir', 'hidden.txt'), 'SEARCH_RULE_NEEDLE ignored directory\n', 'utf8');
  await writeFile(join(root, 'ignored-file.txt'), 'SEARCH_RULE_NEEDLE ignored file\n', 'utf8');
  await mkdir(join(root, 'src', 'keep'), { recursive: true });
  await mkdir(join(root, 'src', 'drop'), { recursive: true });
  await writeFile(join(root, 'src', 'keep', 'kept.txt'), 'SEARCH_RULE_NEEDLE kept child\n', 'utf8');
  await writeFile(join(root, 'src', 'drop', 'dropped.txt'), 'SEARCH_RULE_NEEDLE excluded child\n', 'utf8');
  const nested = join(root, 'packages', 'nested');
  await mkdir(join(nested, '.gradle'), { recursive: true });
  await execFileAsync('git', ['init', '-q', nested]);
  await writeFile(join(nested, '.gitignore'), '.gradle/\nnested-ignored.txt\n', 'utf8');
  await writeFile(join(nested, '.gradle', 'cache.bin'), 'SEARCH_RULE_NEEDLE nested ignored directory\n', 'utf8');
  await writeFile(join(nested, 'nested-ignored.txt'), 'SEARCH_RULE_NEEDLE nested ignored file\n', 'utf8');
  await writeFile(join(nested, 'nested-visible.txt'), 'SEARCH_RULE_NEEDLE nested visible\n', 'utf8');
  return root;
}

test('search directory rules keep a child override under an excluded parent', () => {
  const initial = rules.normalizeSearchDirectoryRules(null);
  const excluded = rules.toggleSearchDirectoryRule('src', initial);
  assert.deepEqual(excluded.excludedDirectories, ['src']);
  assert.equal(rules.searchDirectoryEffectiveState('src/drop', excluded), 'excluded');

  const includedChild = rules.toggleSearchDirectoryRule('src/keep', excluded);
  assert.equal(rules.searchDirectoryEffectiveState('src/keep', includedChild), 'included');
  assert.equal(rules.searchDirectoryEffectiveState('src/keep/file.ts', includedChild), 'included');
  assert.equal(rules.searchDirectoryEffectiveState('src/drop/file.ts', includedChild), 'excluded');
  assert.equal(rules.searchPathAllowedByDirectoryRules('src/drop/file.ts', includedChild), false);
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src', includedChild), true);
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src/keep', includedChild), false);
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src/drop', includedChild), false);

  const includedParent = rules.toggleSearchDirectoryRule('src', includedChild);
  assert.deepEqual(includedParent, { excludedDirectories: [], includedDirectories: [] });
  assert.equal(rules.searchDirectoryEffectiveState('src/drop/file.ts', includedParent), 'included');
  assert.equal(rules.searchDirectoryExcludedWithIncludedDescendant('src', includedParent), false);

  const excludedChild = rules.toggleSearchDirectoryRule('src/keep', includedChild);
  assert.equal(rules.searchDirectoryEffectiveState('src/keep/file.ts', excludedChild), 'excluded');
  assert.deepEqual(excludedChild.includedDirectories, []);
});

test('search directory rules follow rename and move destinations', () => {
  const ruleset = rules.normalizeSearchDirectoryRules({
    excludedDirectories: ['src/old', 'keep'],
    includedDirectories: ['src/old/generated'],
  });
  const moved = rules.remapSearchDirectoryRulesAfterMove(ruleset, [
    ['src/old', 'lib/new'],
    ['keep', 'archive/keep'],
  ]);
  assert.deepEqual(moved.excludedDirectories, ['lib/new', 'archive/keep']);
  assert.deepEqual(moved.includedDirectories, ['lib/new/generated']);
  assert.equal(rules.searchDirectoryEffectiveState('lib/new/file.ts', moved), 'excluded');
  assert.equal(rules.searchDirectoryEffectiveState('lib/new/generated/file.ts', moved), 'included');
  assert.equal(rules.searchDirectoryEffectiveState('src/old/file.ts', moved), 'included');

  const childMovedOut = rules.remapSearchDirectoryRulesAfterMove(ruleset, [['src/old/generated', 'public/generated']]);
  assert.deepEqual(childMovedOut.excludedDirectories, ['src/old', 'keep']);
  assert.deepEqual(childMovedOut.includedDirectories, []);
  assert.equal(rules.searchDirectoryEffectiveState('public/generated/file.ts', childMovedOut), 'included');
});

test('deleting a directory removes its search scope rules and descendants', () => {
  const ruleset = rules.normalizeSearchDirectoryRules({
    excludedDirectories: ['src/drop', 'keep'],
    includedDirectories: ['src/drop/generated', 'keep/manual'],
  });
  const pruned = rules.pruneSearchDirectoryRulesAfterDelete(ruleset, ['src/drop', 'missing']);
  assert.deepEqual(pruned.excludedDirectories, ['keep']);
  assert.deepEqual(pruned.includedDirectories, ['keep/manual']);

  const unchanged = rules.pruneSearchDirectoryRulesAfterDelete(ruleset, ['missing']);
  assert.deepEqual(unchanged, ruleset);

  const batch = rules.pruneSearchDirectoryRulesAfterDelete(ruleset, ['src', 'keep']);
  assert.deepEqual(batch, { excludedDirectories: [], includedDirectories: [] });
});

test('search file and text providers exclude Git ignored directories even with includeExcluded', async (t) => {
  const root = await createSearchFixture(t);
  const files = await host.workspaceFileOperations.files(root, 100, {
    includeExcluded: true,
    respectGitIgnore: true,
  });
  assert.ok(files.files.includes('visible.txt'));
  assert.ok(files.files.includes('src/keep/kept.txt'));
  assert.ok(files.files.includes('packages/nested/nested-visible.txt'));
  assert.ok(!files.files.includes('ignored-dir/hidden.txt'));
  assert.ok(!files.files.includes('ignored-file.txt'));
  assert.ok(!files.files.includes('packages/nested/.gradle/cache.bin'));
  assert.ok(!files.files.includes('packages/nested/nested-ignored.txt'));

  const text = await host.searchWorkspaceText(root, 'SEARCH_RULE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
  });
  const paths = new Set(text.matches.map((match) => match.path));
  assert.ok(paths.has('visible.txt'));
  assert.ok(paths.has('src/keep/kept.txt'));
  assert.ok(paths.has('packages/nested/nested-visible.txt'));
  assert.ok(!paths.has('ignored-dir/hidden.txt'));
  assert.ok(!paths.has('ignored-file.txt'));
  assert.ok(!paths.has('packages/nested/.gradle/cache.bin'));
  assert.ok(!paths.has('packages/nested/nested-ignored.txt'));
});

test('Find and Replace apply custom excluded directories with child include overrides', async (t) => {
  const root = await createSearchFixture(t);
  const searchDirectoryRules = {
    excludedDirectories: ['src'],
    includedDirectories: ['src/keep'],
  };
  const text = await host.searchWorkspaceText(root, 'SEARCH_RULE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
    searchDirectoryRules,
  });
  const paths = new Set(text.matches.map((match) => match.path));
  assert.ok(paths.has('src/keep/kept.txt'));
  assert.ok(!paths.has('src/drop/dropped.txt'));

  await assert.rejects(
    host.replaceWorkspaceText(
      root,
      'SEARCH_RULE_NEEDLE',
      'changed',
      [{ path: 'src/drop/dropped.txt', mtime: 0 }],
      { searchDirectoryRules },
    ),
    /target is outside search scope/u,
  );
  await assert.rejects(
    host.replaceWorkspaceText(
      root,
      'SEARCH_RULE_NEEDLE',
      'changed',
      [{ path: 'ignored-dir/hidden.txt', mtime: 0 }],
      { searchDirectoryRules },
    ),
    /target is outside search scope/u,
  );
});

test('Project folder menu exposes and persists search scope toggles', () => {
  assert.match(editorSource, /toggleSearchDirectoryRule/u);
  assert.match(editorSource, /writeSearchDirectoryRules/u);
  assert.match(editorSource, /id: 'toggleSearchDirectory'/u);
  assert.match(editorSource, /t\('editor\.excludeDirectoryFromSearch'\)/u);
  assert.match(editorSource, /t\('editor\.includeDirectoryInSearch'\)/u);
  assert.match(locales, /excludeDirectoryFromSearch: '排除到搜索'/u);
  assert.match(locales, /includeDirectoryInSearch: '包含到搜索'/u);
});

test('rename and move persist remapped search directory rules', () => {
  const start = editorSource.indexOf('const remapEditorPaths = React.useCallback(');
  assert.notEqual(start, -1);
  const block = editorSource.slice(start, editorSource.indexOf('const remapProjectExpandedPathsForMoves', start));
  assert.match(block, /remapSearchDirectoryRulesAfterMove/u);
  assert.match(block, /writeSearchDirectoryRules/u);
  assert.match(block, /setSearchDirectoryRules/u);
});

test('single and batch delete prune search scope rules after successful deletes', () => {
  const singleStart = editorSource.indexOf('const removeEntry =');
  const single = editorSource.slice(singleStart, editorSource.indexOf('const removeEntries =', singleStart + 1));
  assert.match(single, /pruneSearchDirectoryRulesForDeletedPaths/u);

  const batchStart = editorSource.indexOf('const removeEntries = React.useCallback(');
  const batch = editorSource.slice(batchStart, editorSource.indexOf('const removeEntry =', batchStart));
  assert.match(batch, /deletedPaths\.push\(path\)/u);
  assert.match(batch, /pruneSearchDirectoryRulesForDeletedPaths\(deletedPaths\)/u);
});

test('successful workspace deletion invalidates an active Find result generation', () => {
  const active = {
    query: 'SEARCH_STALE_DELETE_NEEDLE',
    searchGeneration: 4,
    loadedGeneration: 4,
    loading: false,
    error: 'old error',
    files: [{ path: 'drop/file.txt' }],
    matches: [{ path: 'drop/file.txt' }],
  };
  const invalidated = rules.rerunFindToolAfterWorkspaceDelete(active);
  assert.equal(invalidated.searchGeneration, 5);
  assert.equal(invalidated.loadedGeneration, -1);
  assert.equal(invalidated.loading, true);
  assert.equal(invalidated.error, null);
  assert.deepEqual(invalidated.files, active.files);

  const blank = { ...active, query: '' };
  assert.equal(rules.rerunFindToolAfterWorkspaceDelete(blank), blank);

  const start = editorSource.indexOf('const pruneSearchDirectoryRulesForDeletedPaths');
  const block = editorSource.slice(start, editorSource.indexOf('const openFile =', start));
  assert.match(block, /invalidateFindAfterExternalDelete/u);
  assert.match(block, /setFindTool/u);
});

test('watcher deletion sync only treats missing workspace paths as deleted', () => {
  assert.equal(rules.workspaceChangeHasMissingPath([{ path: 'drop/file.txt', exists: false }]), true);
  assert.equal(rules.workspaceChangeHasMissingPath([{ path: 'visible.txt', exists: true }]), false);
  assert.equal(rules.workspaceChangeHasMissingPath(null), false);

  const start = editorSource.indexOf("if (event.type === 'change')");
  const block = editorSource.slice(start, editorSource.indexOf("if (event.type === 'error')", start));
  assert.match(block, /event\.paths/u);
  assert.match(block, /invalidateFindAfterExternalDelete/u);
  assert.match(block, /setFindTool/u);
});

test('the same workspace deletion invalidates Find only once', async () => {
  let state = {
    query: 'SEARCH_STALE_DELETE_NEEDLE',
    searchGeneration: 3,
    loadedGeneration: 3,
    loading: false,
    error: null,
  };
  const update = (updater) => {
    state = updater(state);
  };
  await rules.invalidateFindAfterExternalDelete('dedupe-root-a', ['drop/file.txt'], update, true);
  assert.equal(state.searchGeneration, 4);
  await rules.invalidateFindAfterExternalDelete('dedupe-root-a', ['drop/file.txt'], update, true);
  assert.equal(state.searchGeneration, 4);
  await rules.invalidateFindAfterExternalDelete('dedupe-root-b', ['drop/file.txt'], update, true);
  assert.equal(state.searchGeneration, 5);

  const projectStart = editorSource.indexOf('const pruneSearchDirectoryRulesForDeletedPaths');
  const projectBlock = editorSource.slice(projectStart, editorSource.indexOf('const openFile =', projectStart));
  assert.match(projectBlock, /invalidateFindAfterExternalDelete\(rootRef\.current, paths, setFindTool, true\)/u);
});

test('Find result updates drop collapsed files that no longer exist', () => {
  const current = {
    query: 'needle',
    files: [{ path: 'visible.txt' }],
    matches: [{ path: 'visible.txt' }],
    collapsedFiles: ['visible.txt', 'drop/needle.txt'],
  };
  const pruned = rules.pruneFindCollapsedFiles(current);
  assert.deepEqual(pruned.collapsedFiles, ['visible.txt']);
  assert.equal(rules.pruneFindCollapsedFiles(pruned), pruned);
});

test('Find restores focus only when it owned focus and the row vanished', () => {
  assert.equal(rules.findShouldRestoreFocusAfterResultsChange(true, false, true), true);
  assert.equal(rules.findShouldRestoreFocusAfterResultsChange(false, false, true), false);
  assert.equal(rules.findShouldRestoreFocusAfterResultsChange(true, true, true), false);
  assert.equal(rules.findShouldRestoreFocusAfterResultsChange(true, false, false), false);

  assert.match(findToolSource, /findShouldRestoreFocusAfterResultsChange/u);
});

test('Find releases ownership when pointer or focus leaves its surface', () => {
  assert.equal(rules.findFocusShouldReleaseOutsideSurface(true), false);
  assert.equal(rules.findFocusShouldReleaseOutsideSurface(false), true);
  assert.match(findToolSource, /document\.addEventListener\('pointerdown', releaseFindFocusOwnership, true\)/u);
  assert.match(findToolSource, /document\.addEventListener\('focusin', releaseFindFocusOwnership, true\)/u);
});

test('confirmed Replace All stops when its generation became stale', () => {
  const start = editorSource.indexOf('const replaceInFindTool = React.useCallback(');
  const block = editorSource.slice(start, editorSource.indexOf('const replaceFindToolOccurrence', start));
  const staleAt = block.indexOf('confirmFindReplaceAndGeneration(');
  const confirmAt = block.indexOf('confirmSearchReplace(', staleAt);
  const writeAt = block.indexOf("op: 'replaceText'");
  assert.ok(staleAt >= 0 && confirmAt > staleAt && staleAt < writeAt);
  assert.match(block.slice(staleAt, writeAt), /replaceWriteBusyRef/u);
  assert.match(commitSource, /findToolReplaceAbortState/u);
});

test('Replace confirmation releases busy and refocuses only for cancel or stale generation', async () => {
  const run = async (accepted, currentGeneration, requestGeneration) => {
    const guard = { current: true };
    let state = {
      query: 'needle',
      searchGeneration: currentGeneration,
      replaceFocusRequest: 2,
      replaceBusy: false,
    };
    const acceptedResult = await rules.confirmFindReplaceAndGeneration(
      async () => accepted,
      () => currentGeneration === requestGeneration,
      guard,
      (updater) => {
        state = updater(state);
      },
    );
    return { acceptedResult, guard, state };
  };
  const current = await run(true, 4, 4);
  assert.equal(current.acceptedResult, true);
  assert.equal(current.guard.current, true);
  assert.equal(current.state.replaceFocusRequest, 2);

  const stale = await run(true, 5, 4);
  assert.equal(stale.acceptedResult, false);
  assert.equal(stale.guard.current, false);
  assert.equal(stale.state.replaceFocusRequest, 3);

  const cancelled = await run(false, 4, 4);
  assert.equal(cancelled.acceptedResult, false);
  assert.equal(cancelled.guard.current, false);
  assert.equal(cancelled.state.replaceFocusRequest, 3);
});

test('all search families forward directory rules and Git ignore filtering', () => {
  assert.match(editorSource, /respectGitIgnore: true,\s*searchDirectoryRules/u);
  assert.match(editorSource, /dirtyPaths: dirtyFiles\.map\(\(file\) => file\.path\),\s*searchDirectoryRules/u);
  assert.match(editorSource, /fileMask: normalizeFileExtensionFilter\(searchEverywhere\.fileMask\),\s*searchDirectoryRules/u);
  assert.match(editorSource, /scopeExcludePatterns: findToolScopeExcludePatterns,\s*searchDirectoryRules/u);
});
