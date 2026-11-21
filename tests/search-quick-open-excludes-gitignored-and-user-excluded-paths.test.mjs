import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function loadOpenQuickOpen(callFs, searchDirectoryRules) {
  let state = null;
  const openQuickOpen = loadTypeScriptCallback(workspaceSource, 'openQuickOpen', {
    rememberQuickOpenOrigin: () => {},
    setPaletteMode: () => {},
    quickOpenFilesRequestRef: { current: 0 },
    quickOpenFilesAbortRef: { current: null },
    setQuickOpen(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs,
    searchDirectoryRules,
  });
  return {
    openQuickOpen,
    state: () => state,
  };
}

test('Go to File asks the host to exclude Git-ignored and user-excluded paths', async () => {
  const requests = [];
  const searchDirectoryRules = {
    excludedDirectories: ['vendor'],
    includedDirectories: [],
  };
  const palette = loadOpenQuickOpen(async (payload) => {
    requests.push(payload);
    return { files: ['src/app.ts'] };
  }, searchDirectoryRules);

  await palette.openQuickOpen();

  assert.deepEqual(requests, [
    {
      op: 'files',
      respectGitIgnore: true,
      searchDirectoryRules,
    },
  ]);
  assert.deepEqual(palette.state()?.files, ['src/app.ts']);
});

test('Go to File preserves the host truncation state instead of hiding the limit', async () => {
  const searchDirectoryRules = {
    excludedDirectories: [],
    includedDirectories: [],
  };
  const palette = loadOpenQuickOpen(
    async () => ({
      files: ['src/app.ts'],
      truncated: true,
    }),
    searchDirectoryRules,
  );

  await palette.openQuickOpen();

  assert.equal(palette.state()?.truncated, true);
});
