import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('a stale branch-list failure cannot overwrite the newer branch menu', async () => {
  const requests = [];
  let menu = null;
  const errors = [];
  let busy = false;
  const branchMenuRequestRef = { current: 0 };
  const openBranchMenu = loadTypeScriptCallback(source, 'openBranchMenu', {
    branchMenuRequestRef,
    branchPromptOriginRef: { current: null },
    document: { activeElement: null },
    setCommitBusy: (value) => {
      busy = value;
    },
    setCommitError: (value) => errors.push(value),
    setMenu: (value) => {
      menu = value;
    },
    callGit: () =>
      new Promise((resolve, reject) => {
        requests.push({ resolve, reject });
      }),
    openNamePrompt: () => {},
    checkoutBranch: () => {},
    t: (key) => key,
  });

  const first = openBranchMenu({ x: 10, y: 20 });
  const second = openBranchMenu({ x: 30, y: 40 });
  requests[0].reject(new Error('old branch request failed'));
  requests[1].resolve({ branches: ['main'], branch: 'main' });
  await Promise.all([first, second]);

  assert.equal(menu.owner, 'branch-menu');
  assert.equal(menu.items.find((item) => item?.id === 'branch:main')?.shortcut, '✓');
  assert.deepEqual(errors, [null, null]);
  assert.equal(busy, false);
});
