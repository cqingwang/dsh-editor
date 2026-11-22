import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const component = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('a superseded Quick Open file-list response cannot overwrite the newer open', async () => {
  let quickOpen = { query: '', index: 0, files: [], truncated: false, loading: false, error: null };
  const requests = [];
  const requestRef = { current: 0 };
  const abortRef = { current: null };
  const requestFiles = loadTypeScriptCallback(component, 'requestFiles', {
    requestRef,
    abortRef,
    filesRef: { current: [] },
    truncatedRef: { current: false },
    remoteFilesRef: { current: [] },
    currentQueryRef: { current: '' },
    cancelPendingQuery: () => {},
    scheduleHostQuery: () => {},
    setQuickOpen(update) {
      quickOpen = typeof update === 'function' ? update(quickOpen) : update;
    },
    callFs: (_payload, options) =>
      new Promise((resolve) => {
        requests.push({ resolve, signal: options?.signal });
      }),
    searchTextFailureMessage: (_failure, t) => t('editor.searchQuickOpenFailed'),
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    t: (key) => key,
  });

  requestFiles();
  const firstSignal = requests[0].signal;
  requestFiles();

  assert.equal(firstSignal.aborted, true);
  requests[0].resolve({ files: ['old.ts'] });
  requests[1].resolve({ files: ['new.ts'] });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(quickOpen.files, ['new.ts']);
});

test('closing Quick Open immediately invalidates and aborts its file request', () => {
  const requestRef = { current: 4 };
  let aborted = false;
  const abortRequests = loadTypeScriptCallback(component, 'abortRequests', {
    requestRef,
    abortRef: {
      current: {
        abort() {
          aborted = true;
        },
      },
    },
    cancelPendingQuery: () => {},
  });

  abortRequests();

  assert.equal(requestRef.current, 5);
  assert.equal(aborted, true);
  const closeStart = workspace.indexOf('const closeQuickOpen = React.useCallback');
  const closeBlock = workspace.slice(closeStart, workspace.indexOf('\n  }, [', closeStart));
  assert.match(closeBlock, /quickOpenFileCandidates\.abortRequests\(\);/u);
});
