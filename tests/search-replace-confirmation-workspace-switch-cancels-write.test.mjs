import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, [
  'confirmFindReplaceAndGeneration',
  'dirtyReplaceUndo',
  'findToolReplaceAbortState',
  'findReplaceAttemptIsCurrent',
  'releaseReplaceAttempt',
  'replaceAttemptIsCurrent',
  'replaceAttemptWorkspaceIsCurrent',
  'replaceFailureMessage',
  'replaceOperationState',
  'replaceGenerationIsCurrent',
  'searchReplaceAttemptIsCurrent',
]);

const replaceInFiles = editorSource.slice(
  editorSource.indexOf('const replaceInFiles = React.useCallback'),
  editorSource.indexOf('const replaceInFindTool = React.useCallback'),
);
const replaceInFindTool = editorSource.slice(
  editorSource.indexOf('const replaceInFindTool = React.useCallback'),
  editorSource.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);

test('a replacement attempt belongs only to the workspace that created it', () => {
  const workspaceRequest = { workspaceId: 'workspace-a', sessionId: 'session-a' };
  assert.equal(rules.replaceAttemptWorkspaceIsCurrent(workspaceRequest, 'workspace-a', 'session-a'), true);
  assert.equal(rules.replaceAttemptWorkspaceIsCurrent(workspaceRequest, 'workspace-b', 'session-a'), false);
  const sessionRequest = { workspaceId: '', sessionId: 'session-a' };
  assert.equal(rules.replaceAttemptWorkspaceIsCurrent(sessionRequest, '', 'session-a'), true);
  assert.equal(rules.replaceAttemptWorkspaceIsCurrent(sessionRequest, '', 'session-b'), false);
  assert.equal(rules.replaceAttemptWorkspaceIsCurrent(sessionRequest, 'workspace-b', 'session-a'), false);
  const searchRequest = { workspaceId: '', sessionId: 'session-a', id: 7 };
  assert.equal(rules.searchReplaceAttemptIsCurrent(searchRequest, '', 7, 'session-a'), true);
  assert.equal(rules.searchReplaceAttemptIsCurrent(searchRequest, '', 7, 'session-b'), false);
  const findRequest = { workspaceId: 'workspace-a', sessionId: 'session-a', generation: 4 };
  assert.equal(rules.findReplaceAttemptIsCurrent(findRequest, 'workspace-a', 4, 'session-a'), true);
  assert.equal(rules.findReplaceAttemptIsCurrent(findRequest, 'workspace-b', 4, 'session-a'), false);
});

test('confirmation rechecks live ownership after the dialog closes', async () => {
  const guard = { current: true };
  let state = {
    query: 'needle',
    searchGeneration: 7,
    replaceFocusRequest: 2,
    replaceBusy: false,
  };
  let requestStillCurrent = true;
  const accepted = await rules.confirmFindReplaceAndGeneration(
    async () => {
      requestStillCurrent = false;
      return true;
    },
    () => requestStillCurrent,
    guard,
    (updater) => {
      state = updater(state);
    },
  );
  assert.equal(accepted, false);
  assert.equal(guard.current, false);
  assert.equal(state.replaceFocusRequest, 3);
});

test('partial replacement failures retain the clean-write context', () => {
  const partial = (message) => `partial:${message}`;
  assert.equal(rules.replaceFailureMessage(new Error('dirty failed'), 1, partial), 'partial:dirty failed');
  assert.equal(rules.replaceFailureMessage('host failed', 0, partial), 'host failed');
});

test('dirty undo snapshots and operation counts share one bounded record', () => {
  const dirtyUndo = rules.dirtyReplaceUndo([
    {
      path: 'dirty.ts',
      text: 'after',
      count: 2,
      model: { getValue: () => 'before' },
    },
  ]);
  assert.deepEqual(dirtyUndo, [{ path: 'dirty.ts', beforeContent: 'before', afterContent: 'after' }]);
  const state = rules.replaceOperationState(
    { operationId: 'host-op', replacements: 3 },
    ['clean.ts'],
    ['dirty.ts'],
    2,
    dirtyUndo,
  );
  assert.deepEqual(state.changed, ['clean.ts', 'dirty.ts']);
  assert.equal(state.replacedCount, 5);
  assert.deepEqual(state.operation, {
    operationId: 'host-op',
    clean: true,
    dirty: dirtyUndo,
    files: ['clean.ts', 'dirty.ts'],
    replacements: 5,
  });
});

test('both Replace All confirmations bind the request to workspace and search identity', () => {
  for (const block of [replaceInFiles, replaceInFindTool]) {
    assert.match(block, /workspaceId/u);
  }
  assert.match(
    replaceInFiles,
    /searchReplaceAttemptIsCurrent\(\s*request,\s*currentEditorWorkspaceId\(\),\s*searchTextRequestRef\.current,\s*currentSessionId\(\),?\s*\)/u,
  );
  assert.match(
    replaceInFindTool,
    /findReplaceAttemptIsCurrent\(\s*request,\s*currentEditorWorkspaceId\(\),\s*findToolDraftRef\.current\.searchGeneration,\s*currentSessionId\(\),?\s*\)/u,
  );
});

test('late Replace completion cannot update another workspace', () => {
  for (const block of [replaceInFiles, replaceInFindTool]) {
    const hostResultAt = block.indexOf('hostResult = value;');
    const dirtyCommitAt = block.indexOf('commitFindToolDirtyPlans(dirtyPlans)', hostResultAt);
    assert.ok(hostResultAt >= 0 && dirtyCommitAt > hostResultAt);
    assert.match(block.slice(hostResultAt, dirtyCommitAt), /if \(!requestWorkspaceIsCurrent\(\)\) return;/u);

    const refreshAt = block.indexOf('await refreshHostReplaceChanges(hostChanged)', dirtyCommitAt);
    const rememberAt = block.indexOf('rememberCurrent', refreshAt);
    assert.ok(refreshAt >= 0 && rememberAt > refreshAt);
    assert.match(block.slice(refreshAt, rememberAt), /if \(!requestWorkspaceIsCurrent\(\)\) return;/u);

    const catchAt = block.indexOf('} catch (failure) {');
    const catchMessageAt = block.indexOf('const message = searchReplaceFailureMessage', catchAt);
    assert.ok(catchAt >= 0 && catchMessageAt > catchAt);
    assert.match(block.slice(catchAt, catchMessageAt), /if \(!requestWorkspaceIsCurrent\(\)\) return;/u);
    assert.match(
      block,
      /replaceAttemptWorkspaceIsCurrent\(\s*request,\s*currentEditorWorkspaceId\(\),\s*currentSessionId\(\),?\s*\)/u,
    );
  }
});
