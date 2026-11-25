import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');
const replaceInFiles = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);
const replaceInFind = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const refreshHost = source.slice(
  source.indexOf('const refreshHostReplaceChanges = React.useCallback'),
  source.indexOf(
    "/**\n   * IDEA's Replace in Files apply step.",
    source.indexOf('const refreshHostReplaceChanges = React.useCallback'),
  ),
);
const redoFindReplace = source.slice(
  source.indexOf('const redoFindReplace ='),
  source.indexOf('const dismissExternal = React.useCallback'),
);
const workspaceSearchReset = source.slice(
  source.indexOf('React.useEffect(() => {\n    const previousWorkspaceRoot'),
  source.indexOf("setRecentSearches(root === '' ? [] : readSearchHistory(root));"),
);
const { hostOnlyReplaceOperation } = loadTypeScriptModule(commitSource, ['hostOnlyReplaceOperation']);

test('host-success/dirty-failure refreshes clean files through one shared helper', () => {
  assert.match(refreshHost, /await reloadFile\(path\)/u);
  assert.match(refreshHost, /await loadGit\(\)/u);
  for (const block of [replaceInFiles, replaceInFind]) {
    const hostDeclaration = block.indexOf('const commitTracker = createReplaceCommitTracker()');
    const writeTry = block.indexOf('try {', hostDeclaration);
    const hostChanged = block.indexOf('trackHostReplace(commitTracker, value)');
    const dirtyCommit = block.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
    const refresh = block.indexOf('await refreshHostReplaceChanges(commitTracker.hostChanged)', dirtyCommit);
    const catchAt = block.indexOf('} catch (failure) {', refresh);
    assert.ok(hostDeclaration >= 0 && hostDeclaration < writeTry);
    assert.ok(hostChanged >= 0);
    assert.ok(hostChanged < dirtyCommit && dirtyCommit < refresh && refresh < catchAt);
    assert.match(
      block.slice(catchAt),
      /set(?:SearchEverywhere|FindTool)\([\s\S]*?void refreshHostReplaceChanges\(commitTracker\.hostChanged\)\.catch\(\(\) => \{\}\);/u,
    );
  }
});

test('host-success/dirty-failure reports that clean files were already changed', () => {
  for (const block of [replaceInFiles, replaceInFind]) {
    assert.match(block, /settleCommittedReplaceFailure\(/u);
  }
  assert.ok(source.includes("searchReplacePartialFailure: '替换未完整完成：{message}。已完成修改的磁盘文件已刷新。'"));
  assert.ok(
    source.includes(
      "searchReplacePartialFailure: 'Replace did not complete fully: {message}. Changed disk files were refreshed.'",
    ),
  );
});

test('host-success/dirty-failure records the committed transaction for Undo Last Replace', () => {
  const operation = hostOnlyReplaceOperation({ operationId: 'host-op-1', replacements: 2 }, [
    'clean-a.ts',
    '',
    'clean-b.ts',
  ]);
  assert.deepEqual(operation, {
    operationId: 'host-op-1',
    clean: true,
    dirty: [],
    files: ['clean-a.ts', 'clean-b.ts'],
    replacements: 2,
  });
  assert.equal(hostOnlyReplaceOperation({ operationId: '', replacements: 1 }, ['a.ts']), null);
  assert.equal(hostOnlyReplaceOperation({ operationId: 'host-op-1' }, []), null);
  for (const block of [replaceInFiles, replaceInFind]) {
    const catchAt = block.indexOf('} catch (failure) {');
    const catchBlock = block.slice(catchAt);
    assert.match(catchBlock, /settleCommittedReplaceFailure\(/u);
  }
  assert.match(commitSource, /export function settleCommittedReplaceFailure\(/u);
  assert.match(commitSource, /recordCommittedReplaceOperation\(operation, setRedo, setUndo\)/u);
});

test('partial-success Redo replays only the clean host transaction', () => {
  const operation = hostOnlyReplaceOperation({ operationId: 'host-op-1', replacements: 2 }, ['clean-a.ts']);
  assert.ok(operation);
  assert.deepEqual(operation.dirty, []);
  assert.match(
    redoFindReplace,
    /const value = operation\.clean\s*\? await callFs\(\{\s*op: 'redoReplaceText',\s*operationId: operation\.operationId,\s*\}\)\s*: null;/u,
  );
  assert.match(redoFindReplace, /const dirtyCommit = commitFindToolDirtyPlans\(dirtyPlans\);/u);
  assert.match(
    redoFindReplace,
    /setFindReplaceRedoStack\(\(current\) => current\.slice\(0, -1\)\);\s*setFindReplaceUndoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\);/u,
  );
});

test('switching workspace invalidates replace Undo and Redo stacks', () => {
  assert.match(
    workspaceSearchReset,
    /if \(workspaceSearchSurfacesShouldReset\(previousWorkspaceRoot, root\)\) \{[\s\S]*?setFindReplaceUndoStack\(\[\]\);\s*setFindReplaceRedoStack\(\[\]\);/u,
  );
});
