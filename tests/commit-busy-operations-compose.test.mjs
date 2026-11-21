import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Commit busy remains set until every concurrent Git operation releases its claim', () => {
  let busy = false;
  const scope = {
    repositoryUpdateGuardRef: { current: false },
    commitOperationCountRef: { current: 0 },
    setCommitBusyState: (value) => {
      busy = value;
    },
  };
  const beginCommitOperation = loadTypeScriptCallback(editorSource, 'beginCommitOperation', scope);
  const endCommitOperation = loadTypeScriptCallback(editorSource, 'endCommitOperation', scope);

  assert.equal(beginCommitOperation(), true);
  assert.equal(beginCommitOperation(), true);
  assert.equal(scope.commitOperationCountRef.current, 2);
  assert.equal(busy, true);

  endCommitOperation();
  assert.equal(scope.commitOperationCountRef.current, 1);
  assert.equal(busy, true);

  endCommitOperation();
  assert.equal(scope.commitOperationCountRef.current, 0);
  assert.equal(busy, false);

  scope.repositoryUpdateGuardRef.current = true;
  assert.equal(beginCommitOperation(), false);
  assert.equal(scope.commitOperationCountRef.current, 0);
  assert.equal(busy, false);
});

test('superseded Commit menu requests still release their busy claim', () => {
  assert.doesNotMatch(editorSource, /if \(branchMenuRequestRef\.current === requestId\) endCommitOperation\(\);/u);
  assert.doesNotMatch(editorSource, /if \(commitMenuRequestRef\.current === requestId\) endCommitOperation\(\);/u);
});
