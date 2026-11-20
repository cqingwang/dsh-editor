import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function historyCallbacks(callGit) {
  return {
    git: { isRepo: true },
    callGit,
    beginLogRequest: () => new AbortController(),
    finishLogRequest: () => {},
    authorTimer: { current: null },
    window: { clearTimeout: () => {} },
    setActivity: () => {},
    setPanelVisible: () => {},
    setCommitMode: () => {},
    setHistoryPath: () => {},
    setCommits: () => {},
    setLogExhausted: () => {},
    setLogDetail: () => {},
    setLogError: () => {},
    setCommitError: () => {},
  };
}

test('successful File History clears the previous Log error', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const logErrors = [];
  const commitErrors = [];
  const scope = historyCallbacks(async () => ({ commits: [{ hash: 'a' }] }));
  scope.setLogError = (value) => logErrors.push(value);
  scope.setCommitError = (value) => commitErrors.push(value);
  const showFileHistory = loadTypeScriptCallback(workspace, 'showFileHistory', scope);

  await showFileHistory('src/a.ts');

  assert.deepEqual(logErrors, [null]);
  assert.deepEqual(commitErrors, []);
});

test('failed File History reports on the Log retry channel, not the commit status strip', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const logErrors = [];
  const commitErrors = [];
  const scope = historyCallbacks(async () => {
    throw new Error('history failed');
  });
  scope.setLogError = (value) => logErrors.push(value);
  scope.setCommitError = (value) => commitErrors.push(value);
  const showFileHistory = loadTypeScriptCallback(workspace, 'showFileHistory', scope);

  await showFileHistory('src/a.ts');

  assert.deepEqual(logErrors, ['history failed']);
  assert.deepEqual(commitErrors, []);
});
