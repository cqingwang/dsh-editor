import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const replaceInFiles = workspaceSource.slice(
  workspaceSource.indexOf('const replaceInFiles = React.useCallback'),
  workspaceSource.indexOf('const replaceInFindTool = React.useCallback'),
);
const replaceInFind = workspaceSource.slice(
  workspaceSource.indexOf('const replaceInFindTool = React.useCallback'),
  workspaceSource.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const replaceOccurrence = workspaceSource.slice(
  workspaceSource.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  workspaceSource.indexOf('/* Dirty pre-images must match before host rollback. */'),
);

test('partial success records only the dirty plans that actually committed', () => {
  const {
    committedReplaceOperation,
    committedReplaceOperationFromTracker,
    createReplaceCommitTracker,
    trackDirtyReplace,
    trackHostReplace,
    trackSingleDirtyReplace,
  } = loadTypeScriptModule(commitSource, [
    'committedReplaceOperation',
    'committedReplaceOperationFromTracker',
    'createReplaceCommitTracker',
    'trackDirtyReplace',
    'trackHostReplace',
    'trackSingleDirtyReplace',
  ]);
  const dirtyUndo = [{ path: 'dirty.ts', beforeContent: 'before', afterContent: 'after' }];

  assert.deepEqual(
    committedReplaceOperation(
      { operationId: 'host-op', replacements: 2 },
      ['clean.ts'],
      false,
      ['dirty.ts'],
      1,
      dirtyUndo,
    ),
    {
      operationId: 'host-op',
      clean: true,
      dirty: [],
      files: ['clean.ts'],
      replacements: 2,
    },
  );
  assert.deepEqual(committedReplaceOperation(null, [], true, ['dirty.ts'], 1, dirtyUndo), {
    operationId: '',
    clean: false,
    dirty: dirtyUndo,
    files: ['dirty.ts'],
    replacements: 1,
  });
  assert.deepEqual(
    committedReplaceOperation(
      { operationId: 'host-op', replacements: 2 },
      ['clean.ts'],
      true,
      ['dirty.ts'],
      1,
      dirtyUndo,
    ),
    {
      operationId: 'host-op',
      clean: true,
      dirty: dirtyUndo,
      files: ['clean.ts', 'dirty.ts'],
      replacements: 3,
    },
  );
  assert.equal(committedReplaceOperation(null, [], false, [], 0, dirtyUndo), null);

  const tracker = createReplaceCommitTracker();
  trackHostReplace(tracker, { operationId: 'host-op', replacements: 2, files: ['clean.ts'] });
  trackDirtyReplace(tracker, { count: 1, paths: ['dirty.ts'] }, dirtyUndo);
  assert.deepEqual(committedReplaceOperationFromTracker(tracker), {
    operationId: 'host-op',
    clean: true,
    dirty: dirtyUndo,
    files: ['clean.ts', 'dirty.ts'],
    replacements: 3,
  });

  const single = createReplaceCommitTracker();
  trackSingleDirtyReplace(single, 'dirty.ts', 'before', 'after');
  assert.deepEqual(committedReplaceOperationFromTracker(single), {
    operationId: '',
    clean: false,
    dirty: dirtyUndo,
    files: ['dirty.ts'],
    replacements: 1,
  });
});

test('partial success invalidates stale rows, preview and active row', () => {
  const {
    createReplaceCommitTracker,
    findToolPartialReplaceState,
    findToolReplaceFailureState,
    replaceCommitTrackerHasChanges,
    searchEverywherePartialReplaceState,
    searchEverywhereReplaceFailureState,
    trackHostReplace,
  } = loadTypeScriptModule(commitSource, [
    'createReplaceCommitTracker',
    'findToolPartialReplaceState',
    'findToolReplaceFailureState',
    'replaceCommitTrackerHasChanges',
    'searchEverywherePartialReplaceState',
    'searchEverywhereReplaceFailureState',
    'trackHostReplace',
  ]);
  const tracker = createReplaceCommitTracker();
  trackHostReplace(tracker, { operationId: 'host-op', replacements: 1, files: ['clean.ts'] });
  assert.equal(replaceCommitTrackerHasChanges(tracker), true);

  const findState = {
    matches: [{ path: 'clean.ts', line: 1, column: 1 }],
    files: [{ path: 'clean.ts' }],
    index: 2,
    searchGeneration: 4,
    loadedGeneration: 4,
    replaceAdvanceRowKey: 'row',
    replaceAdvanceRevision: 1,
    replaceBusy: true,
    error: null,
    replaceFocusRequest: 0,
  };
  const nextFind = findToolPartialReplaceState(findState, 4, 'partial');
  assert.deepEqual(nextFind.matches, []);
  assert.deepEqual(nextFind.files, []);
  assert.equal(nextFind.index, 0);
  assert.equal(nextFind.activeRowKey, null);
  assert.equal(nextFind.searchGeneration, 5);
  assert.equal(nextFind.loadedGeneration, -1);
  assert.equal(nextFind.replaceAdvanceRowKey, null);
  assert.equal(nextFind.replaceAdvanceRevision, 2);
  assert.equal(nextFind.error, 'partial');
  assert.equal(nextFind.replacePartialFailure, true);
  assert.equal(nextFind.replacePartialFailureMessage, 'partial');
  assert.equal(nextFind.replaceBusy, false);
  assert.equal(nextFind.replaceFocusRequest, 1);

  const searchState = {
    textMatches: [{ path: 'clean.ts', line: 1, column: 1 }],
    files: [{ path: 'clean.ts' }],
    index: 1,
    activeRowKey: 'text:clean.ts:1:1',
    textRevision: 2,
    textLoading: false,
    textTruncated: true,
    replaceBusy: true,
    error: null,
    replaceFocusRequest: 0,
  };
  const nextSearch = searchEverywherePartialReplaceState(searchState, true, 'partial');
  assert.deepEqual(nextSearch.textMatches, []);
  assert.equal(nextSearch.index, 0);
  assert.equal(nextSearch.activeRowKey, null);
  assert.equal(nextSearch.textRevision, 3);
  assert.equal(nextSearch.textTruncated, false);
  assert.equal(nextSearch.error, 'partial');
  assert.equal(nextSearch.replacePartialFailure, true);
  assert.equal(nextSearch.replacePartialFailureMessage, 'partial');
  assert.equal(nextSearch.replaceBusy, false);

  assert.deepEqual(searchEverywhereReplaceFailureState(searchState, true, 'partial', tracker).textMatches, []);
  assert.deepEqual(findToolReplaceFailureState(findState, 4, 'partial', tracker).matches, []);
  const untouched = findToolReplaceFailureState(findState, 4, 'failed', createReplaceCommitTracker());
  assert.deepEqual(untouched.matches, findState.matches);
});

test('partial-success errors survive the automatic rerun until the query changes', () => {
  const { findToolQueryTransition } = loadTypeScriptModule(commitSource, ['findToolQueryTransition']);
  const next = findToolQueryTransition(
    {
      query: 'needle',
      error: 'partial',
      replacePartialFailure: true,
      searchGeneration: 4,
    },
    'needle',
  );
  assert.equal(next.error, null);
  assert.equal(next.replacePartialFailure, false);
  assert.equal(next.replacePartialFailureMessage, null);
  assert.match(
    workspaceSource,
    /error: current\.replacePartialFailure === true \? current\.replacePartialFailureMessage : null/u,
  );
});

test('Replace All catches record committed dirty changes and clear redo', () => {
  for (const block of [replaceInFiles, replaceInFind]) {
    assert.match(block, /const commitTracker = createReplaceCommitTracker\(\);/u);
    assert.match(block, /trackHostReplace\(commitTracker, value\);/u);
    assert.match(block, /trackDirtyReplace\(commitTracker, dirtyCommit, dirtyUndo\);/u);
    assert.match(block, /committedReplaceOperationFromTracker\(commitTracker\)/u);
    assert.match(
      block,
      /recordCommittedReplaceOperation\(operation, setFindReplaceRedoStack, setFindReplaceUndoStack\);/u,
    );
    assert.match(block, /settleCommittedReplaceFailure\(/u);
    assert.match(block, /searchEverywhereReplaceFailureState|findToolReplaceFailureState/u);
  }
});

test('single Replace records a dirty edit that succeeded before refresh failed', () => {
  assert.match(replaceOccurrence, /const commitTracker = createReplaceCommitTracker\(\);/u);
  assert.match(replaceOccurrence, /trackHostReplace\(commitTracker, value\);/u);
  assert.match(
    replaceOccurrence,
    /trackSingleDirtyReplace\(commitTracker, match\.path, dirtyBeforeContent, dirtyRewrite\.text\);/u,
  );
  assert.match(replaceOccurrence, /committedReplaceOperationFromTracker\(commitTracker\)/u);
  assert.match(
    replaceOccurrence,
    /recordCommittedReplaceOperation\(operation, setFindReplaceRedoStack, setFindReplaceUndoStack\);/u,
  );
  assert.match(replaceOccurrence, /settleCommittedReplaceFailure\(/u);
  assert.match(replaceOccurrence, /findToolReplaceFailureState/u);
});
