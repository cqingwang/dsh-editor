import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('an aborted Load More page cannot append commits from the previous author', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  let releasePage;
  const pageGate = new Promise((resolve) => {
    releasePage = resolve;
  });
  let commits = [{ hash: 'alice-1' }];
  const logMoreRequestRef = { current: null };
  const loadingMoreRef = { current: false };
  const logAuthorRef = { current: 'Alice' };
  const loadMoreLog = loadTypeScriptCallback(workspace, 'loadMoreLog', {
    git: { isRepo: true },
    callGit: async () => {
      await pageGate;
      return { commits: [{ hash: 'alice-2' }] };
    },
    LOG_PAGE: 60,
    logExhausted: false,
    commits,
    logAuthorRef,
    logMoreRequestRef,
    loadingMoreRef,
    logRequestRef: { current: null },
    setCommits: (update) => {
      commits = typeof update === 'function' ? update(commits) : update;
    },
    setLogExhausted: () => {},
    setLogError: () => {},
    setLogLoading: () => {},
    reportGitFailure: (_failure, setError) => setError(null),
  });

  const loading = loadMoreLog();
  assert.ok(logMoreRequestRef.current instanceof AbortController);
  logAuthorRef.current = 'Bob';
  logMoreRequestRef.current.abort();
  releasePage();
  await loading;

  assert.deepEqual(commits, [{ hash: 'alice-1' }]);
  assert.equal(loadingMoreRef.current, false);
});

test('author changes and first-page requests cancel in-flight Log pagination', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');

  assert.match(workspace, /const logMoreRequestRef = React\.useRef<AbortController \| null>\(null\);/u);
  assert.match(workspace, /const cancelLogMoreRequest = React\.useCallback\(\(\): void => \{/u);
  assert.match(workspace, /const beginLogRequest = React\.useCallback\([\s\S]*?cancelLogMoreRequest\(\);/u);
  assert.match(workspace, /commitLogAuthor\.setAuthor\(value\);\s*cancelLogMoreRequest\(\);/u);
  assert.match(
    workspace,
    /op: 'log',\s*limit: LOG_PAGE,\s*skip: requestSkip,\s*author: requestAuthor,?\s*\},\s*\{ signal: controller\.signal \}/u,
  );
});
