import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const preferencesSource = await readFile(
  new URL('../src/client/components/commit/commit-log-view-preferences.ts', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

const normalizeScope = loadTypeScriptFunction(preferencesSource, 'normalizeCommitGraphScope');
const fallbackRequests = new Function(
  'normalizeCommitGraphScope',
  `${transpileTypeScriptFunction(preferencesSource, 'commitGraphScopeFallbackRequests')}\nreturn commitGraphScopeFallbackRequests;`,
)(normalizeScope);
const staleFailure = loadTypeScriptFunction(preferencesSource, 'commitGraphScopeFailureIsStale');
const fallbackNoticeKey = loadTypeScriptFunction(preferencesSource, 'commitGraphScopeFallbackNoticeKey');
const requestWithFallback = new Function(
  'commitGraphScopeFailureIsStale',
  'commitGraphScopeFallbackRequests',
  `${transpileTypeScriptFunction(preferencesSource, 'requestCommitGraphWithScopeFallback')}\nreturn requestCommitGraphWithScopeFallback;`,
)(staleFailure, fallbackRequests);

test('a stale branch scope retries without the branch before clearing the commit scope', () => {
  assert.deepEqual(fallbackRequests('main', 'a'.repeat(40)), [
    { branch: '', at: 'a'.repeat(40), notice: 'branch-at' },
    { branch: '', at: '', notice: 'scope' },
  ]);
  assert.deepEqual(fallbackRequests('main', ''), [{ branch: '', at: '', notice: 'branch' }]);
  assert.deepEqual(fallbackRequests('', 'a'.repeat(40)), [{ branch: '', at: '', notice: 'revision' }]);
  assert.deepEqual(fallbackRequests('', ''), []);
});

test('only stale-ref failures trigger a scope fallback', () => {
  assert.equal(staleFailure('unknown branch: old-feature'), true);
  assert.equal(staleFailure('bad revision: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), true);
  assert.equal(staleFailure('fatal: bad object aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), true);
  assert.equal(staleFailure('fatal: ambiguous argument'), true);
  assert.equal(staleFailure('network request failed'), false);
  assert.equal(staleFailure(''), false);
  assert.equal(staleFailure(null), false);
});

test('each fallback reason maps to a truthful localized notice', () => {
  assert.equal(fallbackNoticeKey('branch'), 'editor.graphScopeBranchReset');
  assert.equal(fallbackNoticeKey('branch-at'), 'editor.graphScopeBranchAtReset');
  assert.equal(fallbackNoticeKey('revision'), 'editor.graphScopeRevisionReset');
  assert.equal(fallbackNoticeKey('scope'), 'editor.graphScopeReset');
});

test('the request helper retries only stale scopes and preserves the final failure', async () => {
  const requests = [];
  const result = await requestWithFallback(
    async (branch, at) => {
      requests.push([branch, at]);
      if (branch === 'old-branch') throw new Error('unknown branch: old-branch');
      return { branch, at };
    },
    'old-branch',
    '',
    true,
  );
  assert.deepEqual(requests, [
    ['old-branch', ''],
    ['', ''],
  ]);
  assert.deepEqual(result, { value: { branch: '', at: '' }, branch: '', at: '', notice: 'branch' });

  await assert.rejects(
    () =>
      requestWithFallback(
        async () => {
          throw new Error('network request failed');
        },
        'main',
        '',
        true,
      ),
    /network request failed/u,
  );
});

test('EditorWorkspace clears a stale persisted graph scope and reports the fallback', () => {
  assert.match(workspaceSource, /requestCommitGraphWithScopeFallback/u);
  assert.match(workspaceSource, /commitLogStorage\.writeGraphScope\(root, result\.branch, result\.at\)/u);
  assert.match(workspaceSource, /setCommitNotice\(\s*t\(commitGraphScopeFallbackNoticeKey\(result\.notice\)/u);
});
