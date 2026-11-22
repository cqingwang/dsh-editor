import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const quickOpenSource = await readFile(
  new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url),
  'utf8',
);

function loadRequestFiles(callFs, searchDirectoryRules) {
  let state = { query: '', index: 0, files: [], truncated: false, loading: false, error: null };
  const requestFiles = loadTypeScriptCallback(quickOpenSource, 'requestFiles', {
    requestRef: { current: 0 },
    abortRef: { current: null },
    filesRef: { current: [] },
    truncatedRef: { current: false },
    remoteFilesRef: { current: [] },
    currentQueryRef: { current: '' },
    cancelPendingQuery: () => {},
    scheduleHostQuery: () => {},
    setQuickOpen(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs,
    searchTextFailureMessage: (_failure, t) => t('editor.searchQuickOpenFailed'),
    searchDirectoryRules,
    t: (key) => key,
  });
  return {
    requestFiles,
    state: () => state,
  };
}

test('Go to File asks the host to exclude Git-ignored and user-excluded paths', async () => {
  const requests = [];
  const searchDirectoryRules = {
    excludedDirectories: ['vendor'],
    includedDirectories: [],
  };
  const palette = loadRequestFiles(async (payload) => {
    requests.push(payload);
    return { files: ['src/app.ts'] };
  }, searchDirectoryRules);

  palette.requestFiles();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(requests, [
    {
      op: 'files',
      respectGitIgnore: true,
      searchDirectoryRules,
      searchIndex: true,
    },
  ]);
  assert.deepEqual(palette.state().files, ['src/app.ts']);
});

test('Go to File preserves the host truncation state instead of hiding the limit', async () => {
  const palette = loadRequestFiles(
    async () => ({
      files: ['src/app.ts'],
      truncated: true,
    }),
    { excludedDirectories: [], includedDirectories: [] },
  );

  palette.requestFiles();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(palette.state().truncated, true);
});
