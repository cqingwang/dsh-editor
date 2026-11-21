import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');
const uploadGuardSource = await readFile(
  new URL('../src/client/components/project/use-project-upload-drop.ts', import.meta.url),
  'utf8',
);
const dirname = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const basename = (path) => path.slice(path.lastIndexOf('/') + 1);

function updateScope(requests) {
  return {
    commitOperationCountRef: { current: 1 },
    repositoryUpdateGuardRef: { current: false },
    gitNetworkRequestGuardRef: { current: false },
    fetchBusy: false,
    updateBusy: false,
    pushBusy: false,
    claimCommitRequestAttempt: () => true,
    openFilesRef: { current: [] },
    window: { confirm: () => true },
    setUpdateBusy: () => {},
    setCommitError: () => {},
    setCommitNotice: () => {},
    setGit: () => {},
    setDiffTarget: () => {},
    setExternalChanges: () => {},
    refreshTree: async () => {},
    reloadFile: async () => {},
    loadLog: async () => {},
    setHistoryPath: () => {},
    reportGitFailure: () => {},
    t: (key) => key,
    callGit: () =>
      new Promise((resolve) => {
        requests.push(resolve);
      }),
  };
}

test('Update Project refuses to start while a Commit write owns the repository', async () => {
  const requests = [];
  const scope = updateScope(requests);
  const updateNow = loadTypeScriptCallback(editorSource, 'updateNow', scope);

  const running = updateNow();

  assert.equal(requests.length, 0);
  requests[0]?.({ branch: 'main' });
  await running;
  assert.equal(scope.repositoryUpdateGuardRef.current, false);
});

test('Update Project owns the working-tree gate only for its request lifetime', async () => {
  const requests = [];
  const scope = updateScope(requests);
  scope.commitOperationCountRef.current = 0;
  const updateNow = loadTypeScriptCallback(editorSource, 'updateNow', scope);

  const running = updateNow();
  assert.equal(requests.length, 1);
  assert.equal(scope.repositoryUpdateGuardRef.current, true);
  requests[0]({ branch: 'main' });
  await running;
  assert.equal(scope.repositoryUpdateGuardRef.current, false);
});

test('every Commit repository write uses the shared Update gate', () => {
  assert.match(editorSource, /const beginCommitOperation = React\.useCallback\(/u);
  assert.match(editorSource, /const endCommitOperation = React\.useCallback\(/u);
  assert.doesNotMatch(editorSource, /\bsetCommitBusy\(true\);/u);
  assert.doesNotMatch(editorSource, /\bsetCommitBusy\(false\);/u);

  const updateStart = editorSource.indexOf('const updateNow = React.useCallback(');
  const updateEnd = editorSource.indexOf("/**\n   * IDEA's Commit tool-window options", updateStart);
  assert.notEqual(updateStart, -1);
  assert.notEqual(updateEnd, -1);
  const updateBlock = editorSource.slice(updateStart, updateEnd);
  assert.match(updateBlock, /if \(commitOperationCountRef\.current > 0\) return;/u);
  assert.match(updateBlock, /repositoryUpdateGuardRef\.current = true;/u);
  assert.match(updateBlock, /finally \{[\s\S]*?repositoryUpdateGuardRef\.current = false;/u);
});

test('Stage and Project Delete refuse writes while Update owns the working tree', async () => {
  const guard = { current: true };
  const count = { current: 0 };
  const beginCommitOperation = loadTypeScriptCallback(editorSource, 'beginCommitOperation', {
    repositoryUpdateGuardRef: guard,
    commitOperationCountRef: count,
    setCommitBusyState: () => {},
  });
  let gitCalls = 0;
  const restage = loadTypeScriptCallback(editorSource, 'restage', {
    beginCommitOperation,
    endCommitOperation: () => {},
    setCommitError: () => {},
    reportGitFailure: () => {},
    setGit: () => {},
    setCommitSelection: () => {},
    setSelectedChanges: () => {},
    selectedChangesRef: { current: new Set() },
    setSelectedChange: () => {},
    groupByFocusRef: { current: null },
    setDiffTarget: () => {},
    window: { setTimeout: (callback) => callback() },
    revealChangeRow: () => {},
    changeModel: {
      movedRows: () => null,
      remainingCommitPaths: () => new Set(),
    },
    callGit: async () => {
      gitCalls += 1;
      return { changes: [] };
    },
  });
  assert.equal(await restage(['a.txt'], true), false);
  assert.equal(gitCalls, 0);
  assert.equal(count.current, 0);

  let fileCalls = 0;
  const removeEntries = loadTypeScriptCallback(editorSource, 'removeEntries', {
    beginCommitOperation,
    endCommitOperation: () => {},
    window: { confirm: () => true },
    dirtyUnder: () => [],
    t: (key) => key,
    callFs: async () => {
      fileCalls += 1;
    },
    pruneSearchDirectoryRulesForDeletedPaths: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
    activePathRef: { current: null },
    closeFile: () => {},
    setTreeError: () => {},
  });
  await removeEntries(['a.txt']);
  assert.equal(fileCalls, 0);
  assert.equal(count.current, 0);

  const removeEntry = loadTypeScriptCallback(editorSource, 'removeEntry', {
    beginCommitOperation,
    endCommitOperation: () => {},
    window: { confirm: () => true },
    dirtyUnder: () => [],
    t: (key) => key,
    projectName: 'workspace',
    callFs: async () => {
      fileCalls += 1;
    },
    pruneSearchDirectoryRulesForDeletedPaths: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
    activePathRef: { current: null },
    closeFile: () => {},
    setTreeError: () => {},
  });
  await removeEntry({ path: 'a.txt' });
  assert.equal(fileCalls, 0);
  assert.equal(count.current, 0);
});

test('Project create, rename, move, save and upload refuse while Update owns the tree', async () => {
  const guard = { current: true };
  const count = { current: 0 };
  const beginCommitOperation = loadTypeScriptCallback(editorSource, 'beginCommitOperation', {
    repositoryUpdateGuardRef: guard,
    commitOperationCountRef: count,
    setCommitBusyState: () => {},
  });
  const endCommitOperation = () => {};

  let createCalls = 0;
  const createEntry = loadTypeScriptCallback(editorSource, 'createEntry', {
    beginCommitOperation,
    endCommitOperation,
    createState: {
      kind: 'file',
      parent: 'src',
      value: 'new.ts',
      template: false,
    },
    callFs: async () => {
      createCalls += 1;
      return { entries: [] };
    },
    setTreeError: () => {},
    t: (key) => key,
    templateFor: () => '',
    setEntries: () => {},
    setChildren: () => {},
    setExpanded: () => {},
    setSelectedPath: () => {},
    setCreateState: () => {},
    setRenameState: () => {},
    openFile: async () => {},
    showHidden: false,
    sortMode: 'name',
    foldersFirst: true,
    showExcludedFiles: false,
  });
  await createEntry();
  assert.equal(createCalls, 0);

  let renameCalls = 0;
  const commitRename = loadTypeScriptCallback(editorSource, 'commitRename', {
    beginCommitOperation,
    endCommitOperation,
    renameState: { path: 'src/old.ts', value: 'new.ts' },
    callFs: async () => {
      renameCalls += 1;
    },
    remapEditorPaths: () => {},
    remapProjectExpandedPathsForMoves: () => {},
    remapProjectManualOrderForMoves: () => {},
    setRenameState: () => {},
    setSelectedPath: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
    setTreeError: () => {},
    t: (key) => key,
    dirname,
  });
  await commitRename();
  assert.equal(renameCalls, 0);

  let moveCalls = 0;
  const moveEntry = loadTypeScriptCallback(editorSource, 'moveEntry', {
    beginCommitOperation,
    endCommitOperation,
    rows: [],
    callFs: async () => {
      moveCalls += 1;
      return [];
    },
    basename,
    planMoves: () => ({ moves: [], intoSelf: [], conflicts: [] }),
    focusProjectAfterOption: () => {},
    applyTreeSelection: () => {},
    loadGit: async () => {},
    refreshTree: async () => {},
    remapEditorPaths: () => {},
    remapProjectExpandedPathsForMoves: () => {},
    remapProjectManualOrderForMoves: () => {},
    t: (key) => key,
    describeMoveResult: () => null,
    describeMoved: () => null,
    setTreeError: () => {},
  });
  await moveEntry('src/a.ts', 'lib');
  assert.equal(moveCalls, 0);

  let saveCalls = 0;
  const savePath = loadTypeScriptCallback(editorSource, 'savePath', {
    beginCommitOperation,
    endCommitOperation,
    modelsRef: {
      current: new Map([['a.txt', { getValue: () => 'changed' }]]),
    },
    openFilesRef: { current: [{ path: 'a.txt', mtime: 1 }] },
    callFs: async () => {
      saveCalls += 1;
      return { mtime: 2 };
    },
    setOpenFiles: () => {},
    setEditorError: () => {},
    setConflict: () => {},
    loadGit: async () => {},
  });
  await savePath('a.txt');
  assert.equal(saveCalls, 0);

  let saveAllCalls = 0;
  const saveAll = loadTypeScriptCallback(editorSource, 'saveAll', {
    saveAllInFlightRef: { current: false },
    beginCommitOperation,
    endCommitOperation,
    openFilesRef: { current: [{ path: 'a.txt', dirty: true, mtime: 1 }] },
    modelsRef: { current: new Map([['a.txt', { getValue: () => 'changed' }]]) },
    callFs: async () => {
      saveAllCalls += 1;
      return { mtime: 2 };
    },
    setOpenFiles: () => {},
    setConflict: () => {},
    setEditorError: () => {},
    flashStatus: () => {},
    loadGit: async () => {},
    t: (key) => key,
  });
  assert.equal(await saveAll(), 0);
  assert.equal(saveAllCalls, 0);

  let uploadCalls = 0;
  const uploadProjectDropWithGuard = loadTypeScriptFunction(uploadGuardSource, 'uploadProjectDropWithGuard');
  await uploadProjectDropWithGuard(
    { beginOperation: beginCommitOperation, endOperation: endCommitOperation },
    [],
    '',
    async () => {
      uploadCalls += 1;
    },
  );
  assert.equal(uploadCalls, 0);
  assert.match(editorSource, /const uploadDroppedEntries = useProjectUploadDrop\(\{/u);
  assert.equal(count.current, 0);
});

test('Commit form exposes Update Project as a working-tree write gate', () => {
  assert.match(panelSource, /workingTreeBusy\?: boolean;/u);
  assert.match(
    panelSource,
    /disabled=\{[\s\S]{0,180}?workingTreeBusy[\s\S]{0,120}?selectedPaths\.size === 0[\s\S]{0,80}?\}/u,
  );
  assert.match(editorSource, /workingTreeBusy=\{updateBusy\}/u);
});
