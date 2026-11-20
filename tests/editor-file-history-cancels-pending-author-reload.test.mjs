import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('opening File History cancels a pending author-filter reload', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const cleared = [];
  const authorTimer = { current: 7 };
  const showFileHistory = loadTypeScriptCallback(workspace, 'showFileHistory', {
    git: { isRepo: true },
    authorTimer,
    window: {
      clearTimeout: (timer) => cleared.push(timer),
    },
    callGit: async () => ({ commits: [] }),
    beginLogRequest: () => new AbortController(),
    finishLogRequest: () => {},
    setActivity: () => {},
    setPanelVisible: () => {},
    setCommitMode: () => {},
    setHistoryPath: () => {},
    setCommits: () => {},
    setLogExhausted: () => {},
    setLogDetail: () => {},
    setLogError: () => {},
  });

  await showFileHistory('src/a.ts');

  assert.deepEqual(cleared, [7]);
  assert.equal(authorTimer.current, null);
});

test('author debounce state is declared before File History can use it', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const timerAt = workspace.indexOf("const authorTimer = React.useRef(null);");
  const historyAt = workspace.indexOf('const showFileHistory = React.useCallback(');

  assert.ok(timerAt >= 0);
  assert.ok(historyAt > timerAt);
});
