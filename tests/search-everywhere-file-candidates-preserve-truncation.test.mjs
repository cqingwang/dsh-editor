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
const mergeFileCandidates = loadTypeScriptFunction(
  extractFunctionSource(fileCandidatesSource, 'mergeFileCandidates'),
  'mergeFileCandidates',
);
const searchEverywhereFilesForScope = loadTypeScriptFunction(
  extractFunctionSource(searchEverywhereSource, 'searchEverywhereFilesForScope'),
  'searchEverywhereFilesForScope',
);
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

test('a bounded response over a complete search scope does not report missing project files', async () => {
  let state = {
    includeNonProject: false,
    files: [],
    filesTruncated: false,
    error: null,
  };
  const truncatedRef = { current: false };
  const requestFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestFiles', {
    requestRef: { current: 0 },
    abortRef: { current: null },
    filesRef: { current: [] },
    truncatedRef,
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
      scopeComplete: true,
    }),
    searchTextFailureMessage,
    t,
  });

  requestFiles(false);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(truncatedRef.current, true);
  assert.equal(state.filesScopeComplete, true);
  assert.equal(state.filesTruncated, false);
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

test('a complete typed file query clears the base-list truncation warning', async () => {
  let state = {
    query: 'application.java',
    files: [{ path: 'base.ts' }],
    filesTruncated: true,
    error: null,
    errorSource: null,
  };
  const requestHostQueryFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestHostQueryFiles', {
    queryRequestRef: { current: 0 },
    queryAbortRef: { current: null },
    truncatedRef: { current: true },
    filesRef: { current: [{ path: 'base.ts' }] },
    remoteFilesRef: { current: [] },
    currentQueryRef: { current: 'application.java' },
    scopeRef: { current: false },
    fileMaskRef: { current: '' },
    mergeFileCandidates,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async () => ({
      entries: [{ path: 'Application.java', kind: 'file' }],
      truncated: false,
    }),
    searchTextFailureMessage,
    t,
  });

  requestHostQueryFiles('application.java', false, '');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.filesTruncated, false);
  assert.deepEqual(state.files, [{ path: 'base.ts' }, { path: 'Application.java' }]);
});

test('a typed file query runs against the complete host index before the base list settles', async () => {
  const requests = [];
  let state = {
    query: 'Application.java',
    files: [],
    filesTruncated: false,
    error: null,
    errorSource: null,
  };
  const requestHostQueryFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestHostQueryFiles', {
    queryRequestRef: { current: 0 },
    queryAbortRef: { current: null },
    truncatedRef: { current: false },
    filesRef: { current: [] },
    remoteFilesRef: { current: [] },
    currentQueryRef: { current: 'Application.java' },
    scopeRef: { current: false },
    fileMaskRef: { current: '' },
    mergeFileCandidates,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async (payload) => {
      requests.push(payload);
      return {
        entries: [{ path: 'src/Application.java', kind: 'file' }],
        truncated: false,
      };
    },
    searchTextFailureMessage,
    t,
  });

  requestHostQueryFiles('Application.java', false, '');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].op, 'search');
  assert.deepEqual(state.files, [{ path: 'src/Application.java' }]);
});

test('a typed file query exposes index hits before the base file scope settles', async () => {
  let state = {
    query: 'application.java',
    includeNonProject: false,
    files: [],
    filesScope: undefined,
    filesTruncated: false,
    error: null,
    errorSource: null,
  };
  const requestHostQueryFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestHostQueryFiles', {
    queryRequestRef: { current: 0 },
    queryAbortRef: { current: null },
    truncatedRef: { current: false },
    filesRef: { current: [] },
    remoteFilesRef: { current: [] },
    currentQueryRef: { current: 'application.java' },
    scopeRef: { current: false },
    fileMaskRef: { current: '' },
    mergeFileCandidates,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async () => ({
      entries: [{ path: 'src/Application.java', kind: 'file' }],
      truncated: true,
    }),
    searchTextFailureMessage,
    t,
  });

  requestHostQueryFiles('application.java', false, '');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.filesScope, false);
  assert.deepEqual(
    searchEverywhereFilesForScope(state.files, state.filesScope, state.includeNonProject),
    [{ path: 'src/Application.java' }],
  );
});
