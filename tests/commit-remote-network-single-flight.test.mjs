import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptModule } from './ts-source.mjs';

const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const { claimCommitRequestAttempt, commitRetryFocusTarget } = loadTypeScriptModule(commitSource, [
  'claimCommitRequestAttempt',
  'commitRetryFocusTarget',
]);

function fetchScope(requests) {
  return {
    fetchBusy: false,
    updateBusy: false,
    pushBusy: false,
    commitOperationCountRef: { current: 0 },
    repositoryUpdateGuardRef: { current: false },
    gitNetworkRequestGuardRef: { current: false },
    claimCommitRequestAttempt,
    setFetchBusy: () => {},
    setCommitError: () => {},
    setCommitNotice: () => {},
    setPushError: () => {},
    reportGitFailure: () => {},
    setGit: () => {},
    t: (key) => key,
    callGit: () =>
      new Promise((resolve) => {
        requests.push(resolve);
      }),
  };
}

function updateScope(requests) {
  return {
    fetchBusy: false,
    updateBusy: false,
    pushBusy: false,
    commitOperationCountRef: { current: 0 },
    repositoryUpdateGuardRef: { current: false },
    gitNetworkRequestGuardRef: { current: false },
    claimCommitRequestAttempt,
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

function pushScope(requests) {
  return {
    fetchBusy: false,
    updateBusy: false,
    pushBusy: false,
    gitNetworkRequestGuardRef: { current: false },
    claimCommitRequestAttempt,
    commitRetryFocusTarget,
    activityRef: { current: 'commit' },
    panelVisibleRef: { current: true },
    focusToolWindowContent: () => {},
    setPushBusy: () => {},
    setCommitError: () => {},
    setCommitNotice: () => {},
    setPushError: () => {},
    setGit: () => {},
    reportGitFailure: () => {},
    t: (key) => key,
    callGit: () =>
      new Promise((resolve) => {
        requests.push(resolve);
      }),
  };
}

test('Fetch rejects a same-frame repeat before React busy paints', async () => {
  const requests = [];
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', fetchScope(requests));

  const first = fetchNow();
  const second = fetchNow();

  assert.equal(requests.length, 1);
  requests[0]({ remotes: [] });
  await Promise.all([first, second]);
  assert.equal(requests.length, 1);
});

test('Update rejects a same-frame repeat before React busy paints', async () => {
  const requests = [];
  const updateNow = loadTypeScriptCallback(editorSource, 'updateNow', updateScope(requests));

  const first = updateNow();
  const second = updateNow();

  assert.equal(requests.length, 1);
  requests[0]({ branch: 'main' });
  await Promise.all([first, second]);
  assert.equal(requests.length, 1);
});

test('Fetch and Update share one Git network request claim', async () => {
  const requests = [];
  const scope = {
    ...fetchScope(requests),
    ...updateScope(requests),
  };
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', scope);
  const updateNow = loadTypeScriptCallback(editorSource, 'updateNow', scope);

  const fetch = fetchNow();
  const update = updateNow();

  assert.equal(requests.length, 1);
  requests[0]({ branch: 'main', remotes: [] });
  await Promise.all([fetch, update]);
  assert.equal(scope.gitNetworkRequestGuardRef.current, false);
});

test('a failed network request releases the claim for a later retry', async () => {
  const requests = [];
  const scope = fetchScope(requests);
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', scope);

  const failed = fetchNow();
  requests[0](Promise.reject(new Error('network unavailable')));
  await failed;
  assert.equal(scope.gitNetworkRequestGuardRef.current, false);

  const retry = fetchNow();
  assert.equal(requests.length, 2);
  requests[1]({ remotes: [] });
  await retry;
});

test('Push rejects a same-frame repeat before React busy paints', async () => {
  const requests = [];
  const pushNow = loadTypeScriptCallback(editorSource, 'pushNow', pushScope(requests));

  const first = pushNow();
  const second = pushNow();

  assert.equal(requests.length, 1);
  requests[0]({ branch: 'main' });
  await Promise.all([first, second]);
});

test('Fetch and Push share one Git network request claim', async () => {
  const requests = [];
  const scope = {
    ...fetchScope(requests),
    ...updateScope(requests),
    ...pushScope(requests),
  };
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', scope);
  const pushNow = loadTypeScriptCallback(editorSource, 'pushNow', scope);

  const fetch = fetchNow();
  const push = pushNow();

  assert.equal(requests.length, 1);
  requests[0]({ branch: 'main', remotes: [] });
  await Promise.all([fetch, push]);
});

test('Push blocks Fetch and Update while it owns the network request', async () => {
  const requests = [];
  const scope = {
    ...fetchScope(requests),
    ...updateScope(requests),
    ...pushScope(requests),
  };
  const pushNow = loadTypeScriptCallback(editorSource, 'pushNow', scope);
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', scope);
  const updateNow = loadTypeScriptCallback(editorSource, 'updateNow', scope);

  const push = pushNow();
  const fetch = fetchNow();
  const update = updateNow();

  assert.equal(requests.length, 1);
  requests[0]({ branch: 'main' });
  await Promise.all([push, fetch, update]);
});

test('a failed Push releases the shared claim for a later Fetch', async () => {
  const requests = [];
  const scope = {
    ...fetchScope(requests),
    ...updateScope(requests),
    ...pushScope(requests),
  };
  const pushNow = loadTypeScriptCallback(editorSource, 'pushNow', scope);
  const fetchNow = loadTypeScriptCallback(editorSource, 'fetchNow', scope);

  const failed = pushNow();
  requests[0](Promise.reject(new Error('push rejected')));
  await failed;
  assert.equal(scope.gitNetworkRequestGuardRef.current, false);

  const retry = fetchNow();
  assert.equal(requests.length, 2);
  requests[1]({ remotes: [] });
  await retry;
});
