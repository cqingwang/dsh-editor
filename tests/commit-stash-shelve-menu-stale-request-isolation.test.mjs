import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('a stale Stash list failure cannot overwrite the newer menu', async () => {
  const requests = [];
  const errors = [];
  let menu = null;
  let busy = false;
  const commitMenuRequestRef = { current: 0 };
  const openStashMenu = loadTypeScriptCallback(source, 'openStashMenu', {
    commitMenuRequestRef,
    beginCommitOperation: () => {
      busy = true;
      return true;
    },
    endCommitOperation: () => {
      busy = false;
    },
    setCommitError: (value) => errors.push(value),
    setMenu: (value) => {
      menu = value;
    },
    callGit: () =>
      new Promise((resolve, reject) => {
        requests.push({ resolve, reject });
      }),
    git: { changes: [] },
    stashMenu: ({ entries }) => ({ owner: 'stash-menu', entries }),
    runStash: () => {},
    t: (key) => key,
  });

  const first = openStashMenu({ x: 1, y: 2 });
  const second = openStashMenu({ x: 3, y: 4 });
  requests[0].reject(new Error('old stash list failed'));
  requests[1].resolve({ entries: [{ ref: 'stash@{0}' }] });
  await Promise.all([first, second]);

  assert.equal(menu.owner, 'stash-menu');
  assert.deepEqual(menu.entries, [{ ref: 'stash@{0}' }]);
  assert.deepEqual(errors, [null, null]);
  assert.equal(busy, false);
});

test('Stash and Shelve menus share request generation isolation', () => {
  const block = source.slice(
    source.indexOf('const openStashMenu = React.useCallback('),
    source.indexOf('/* Batch delete for the Project tool window'),
  );

  assert.match(block, /const requestId = \+\+commitMenuRequestRef\.current;/u);
  assert.match(block, /if \(commitMenuRequestRef\.current !== requestId\) return;/u);
  assert.match(block, /finally \{\s+endCommitOperation\(\);\s+\}/u);
});

test('workspace reset invalidates pending Stash and Shelve list requests', () => {
  const cancelStart = source.indexOf('const cancelWorkspaceSearchRequests = React.useCallback');
  const cancelEnd = source.indexOf('const previousWorkspaceSearchRootRef', cancelStart);
  assert.ok(cancelStart >= 0 && cancelEnd > cancelStart, 'workspace cancellation block is missing');
  const cancelBlock = source.slice(cancelStart, cancelEnd);

  const resetStart = source.indexOf('if (workspaceSearchSurfacesShouldReset(previousWorkspaceRoot, root))');
  const resetEnd = source.indexOf('setRecentReplacements(root === \'\' ? [] : readReplaceHistory(root));', resetStart);
  assert.ok(resetStart >= 0 && resetEnd > resetStart, 'workspace reset block is missing');
  const resetBlock = source.slice(resetStart, resetEnd);

  assert.match(cancelBlock, /commitMenuRequestRef\.current \+= 1;/u);
  assert.match(resetBlock, /cancelWorkspaceSearchRequests\(\);/u);
  assert.match(resetBlock, /clearSearchEverywhereFileCache\(\);/u);
});
