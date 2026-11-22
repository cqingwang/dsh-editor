import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptModule } from './ts-source.mjs';

const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const quickOpenSource = await readFile(
  new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url),
  'utf8',
);
const { searchTextFailureMessage } = loadTypeScriptModule(editorCoreSource, ['searchTextFailureMessage']);
const t = (key) => key;

function loadRequestFiles(callFs) {
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
    searchTextFailureMessage,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    t,
  });
  return {
    requestFiles,
    state: () => state,
  };
}

test('Go to File reports loading until the host file list arrives', async () => {
  let resolveFiles;
  const palette = loadRequestFiles(
    () =>
      new Promise((resolve) => {
        resolveFiles = resolve;
      }),
  );

  palette.requestFiles();
  assert.equal(palette.state().loading, true);
  assert.equal(palette.state().error, null);
  resolveFiles({ files: ['README.md'] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(palette.state(), {
    query: '',
    index: 0,
    files: ['README.md'],
    truncated: false,
    loading: false,
    error: null,
  });
});

test('Go to File surfaces a host enumeration failure instead of an empty result', async () => {
  const palette = loadRequestFiles(async () => {
    throw new Error('workspace listing failed');
  });

  palette.requestFiles();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(palette.state(), {
    query: '',
    index: 0,
    files: [],
    truncated: false,
    loading: false,
    error: 'workspace listing failed',
  });
  assert.match(quickOpenSource, /role='alert'>\s*\{error\}\s*<\/div>/u);
  assert.match(quickOpenSource, /error === null && matches\.length === 0 && !loading/u);
});
