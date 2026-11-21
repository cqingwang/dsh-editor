import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, ['claimCommitRequestAttempt']);

test('Commit retry claims one synchronous request before React busy state commits', () => {
  const guard = { current: false };
  assert.equal(rules.claimCommitRequestAttempt(false, guard), true);
  assert.equal(guard.current, true);
  assert.equal(rules.claimCommitRequestAttempt(false, guard), false);

  guard.current = false;
  assert.equal(rules.claimCommitRequestAttempt(true, guard), false);
  assert.equal(guard.current, false);
  assert.equal(rules.claimCommitRequestAttempt(false, null), false);
});

test('status and push Retry both release their request claim in finally', () => {
  const statusStart = editorSource.indexOf('const retryCommitStatus = React.useCallback(');
  const statusEnd = editorSource.indexOf('const restoredToolWindowFocusRef', statusStart);
  assert.notEqual(statusStart, -1);
  assert.notEqual(statusEnd, -1);
  const statusBlock = editorSource.slice(statusStart, statusEnd);
  assert.match(statusBlock, /claimCommitRequestAttempt\(false, commitStatusRetryGuardRef\)/u);
  assert.match(
    statusBlock,
    /finally \{\s+commitStatusRetryGuardRef\.current = false;\s+setCommitStatusRetrying\(false\);\s+\}/u,
  );

  const pushStart = editorSource.indexOf('const pushNow = React.useCallback(');
  const pushEnd = editorSource.indexOf('/**\n   * Fetch every remote', pushStart);
  assert.notEqual(pushStart, -1);
  assert.notEqual(pushEnd, -1);
  const pushBlock = editorSource.slice(pushStart, pushEnd);
  assert.match(pushBlock, /claimCommitRequestAttempt\(pushBusy \|\| fetchBusy \|\| updateBusy, gitNetworkRequestGuardRef\)/u);
  assert.match(pushBlock, /finally \{\s+gitNetworkRequestGuardRef\.current = false;\s+setPushBusy\(false\);\s+\}/u);
});
