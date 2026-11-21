import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractFunctionSource,
  loadTypeScriptCallback,
  loadTypeScriptFunction,
  loadTypeScriptModule,
} from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const fileCandidatesSource = await readFile(
  new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
  'utf8',
);
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const { searchTextFailureMessage } = loadTypeScriptModule(editorCoreSource, ['searchTextFailureMessage']);
const t = (key) => key;

test('Search Everywhere preserves file-candidate truncation from the host', async () => {
  let state = {
    includeNonProject: true,
    files: [],
    filesTruncated: false,
    error: null,
  };
  const requestFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestFiles', {
    requestRef: { current: 0 },
    abortRef: { current: null },
    filesRef: { current: [] },
    truncatedRef: { current: false },
    scopeRef: { current: null },
    fileMaskRef: { current: '' },
    currentQueryRef: { current: '' },
    remoteFilesRef: { current: [] },
    cancelPendingQuery: () => {},
    searchEverywhereFilesRequestState: (current) => current,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async () => ({
      files: ['src/app.ts'],
      truncated: true,
    }),
    searchTextFailureMessage,
    t,
  });

  requestFiles(true);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(state.files, [{ path: 'src/app.ts' }]);
  assert.equal(state.filesScope, true);
  assert.equal(state.filesTruncated, true);
});

test('Search Everywhere hides cached files until they belong to the active scope', () => {
  const filesForScope = loadTypeScriptFunction(
    extractFunctionSource(searchEverywhereSource, 'searchEverywhereFilesForScope'),
    'searchEverywhereFilesForScope',
  );
  const files = [{ path: 'src/app.ts' }];

  assert.deepEqual(filesForScope(files, false, false), files);
  assert.deepEqual(filesForScope(files, false, true), []);
  assert.deepEqual(filesForScope(files, true, true), files);
});

test('Search Everywhere marks file-provider failures so only that provider can retry', async () => {
  let state = {
    includeNonProject: true,
    files: [],
    filesScope: true,
    filesTruncated: false,
    error: null,
    errorSource: null,
  };
  const requestFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestFiles', {
    requestRef: { current: 0 },
    abortRef: { current: null },
    filesRef: { current: [] },
    truncatedRef: { current: false },
    scopeRef: { current: null },
    fileMaskRef: { current: '' },
    currentQueryRef: { current: '' },
    remoteFilesRef: { current: [] },
    cancelPendingQuery: () => {},
    searchEverywhereFilesRequestState: (current) => current,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async () => {
      throw new Error('file enumeration failed');
    },
    searchTextFailureMessage,
    t,
  });

  requestFiles(true);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.error, 'file enumeration failed');
  assert.equal(state.errorSource, 'files');
});
