import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractFunctionSource,
  loadTypeScriptCallback,
  loadTypeScriptFunction,
  loadTypeScriptModule,
} from './ts-source.mjs';

const host = await import('../lib/index.js');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const fileCandidatesSource = await readFile(
  new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
  'utf8',
);
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const { searchTextFailureMessage } = loadTypeScriptModule(editorCoreSource, ['searchTextFailureMessage']);
const mergeFileCandidates = loadTypeScriptFunction(
  extractFunctionSource(fileCandidatesSource, 'mergeFileCandidates'),
  'mergeFileCandidates',
);
const t = (key) => key;

test('Search Everywhere marks its filename query fallback as file-only', () => {
  assert.match(fileCandidatesSource, /filesOnly: true,/);
});

test('Search Everywhere file candidates apply File Mask before the file budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-files-mask-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 2001; index += 1) {
    await writeFile(join(root, `noise-${String(index).padStart(4, '0')}.md`), '# noise\n', 'utf8');
  }
  await writeFile(join(root, 'zz-visible.ts'), 'export const visible = true;\n', 'utf8');

  const result = await host.workspaceFileOperations.files(root, 2000, {
    includeExcluded: true,
    fileMask: '*.ts',
  });

  assert.deepEqual(result.files, ['zz-visible.ts']);
  assert.equal(result.truncated, false);
});

test('Search Everywhere query fallback applies File Mask before its traversal budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-query-mask-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a-noise.md'), 'no match\n', 'utf8');
  await writeFile(join(root, 'b-noise.md'), 'no match\n', 'utf8');
  await writeFile(join(root, 'query-mask-needle.ts'), 'match\n', 'utf8');

  const result = await host.workspaceFileOperations.search(root, 'query-mask-needle', {
    fileMask: '*.ts',
    maxVisited: 1,
    showHidden: true,
    showExcluded: true,
  });

  assert.deepEqual(result.entries.map((entry) => entry.path), ['query-mask-needle.ts']);
  assert.equal(result.truncated, false);
});

test('Search Everywhere forwards File Mask with the file-list request', async () => {
  const requests = [];
  let state = {
    includeNonProject: true,
    files: [],
    filesScope: true,
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
    searchEverywhereFilesRequestState: (current) => current,
    cancelPendingQuery: () => {},
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async (payload) => {
      requests.push(payload);
      return { files: ['src/app.ts'], truncated: false };
    },
    searchTextFailureMessage,
    t,
  });

  requestFiles(true, '*.ts');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].fileMask, '*.ts');
});

test('Search Everywhere refreshes files after a debounced File Mask change', async () => {
  const requests = [];
  let state = {
    includeNonProject: false,
    files: [{ path: 'src/app.ts' }],
    filesScope: false,
    filesTruncated: false,
    error: null,
  };
  const updateFileMask = loadTypeScriptCallback(
    fileCandidatesSource,
    'updateFileMask',
    {
      fileMaskTimerRef: { current: null },
      fileMaskRef: { current: '' },
      remoteFilesRef: { current: [{ path: 'vendor/old.js' }] },
      cancelPendingFileMask: () => {},
      cancelPendingQuery: () => {},
      requestFiles: (includeNonProject, fileMask) => {
        requests.push({ includeNonProject, fileMask });
      },
      setSearchEverywhere(update) {
        state = typeof update === 'function' ? update(state) : update;
      },
    },
  );

  updateFileMask('*.ts', false);
  assert.equal(state.fileMask, '*.ts');
  assert.deepEqual(requests, []);
  await new Promise((resolve) => setTimeout(resolve, 220));

  assert.deepEqual(requests, [{ includeNonProject: false, fileMask: '*.ts' }]);
});

test('Search Everywhere File Mask immediately owns the query fallback', async () => {
  const requests = [];
  const queryAbort = new AbortController();
  let queryFallbackCancelled = 0;
  let state = {
    query: 'beyond-cap',
    includeNonProject: false,
    fileMask: '',
    files: [{ path: 'src/app.ts' }, { path: 'vendor/old.js' }],
    filesScope: false,
    filesTruncated: true,
    error: null,
    errorSource: null,
  };
  const fileMaskRef = { current: '' };
  const remoteFilesRef = { current: [{ path: 'vendor/old.js' }] };
  const updateFileMask = loadTypeScriptCallback(
    fileCandidatesSource,
    'updateFileMask',
    {
      fileMaskTimerRef: { current: null },
      fileMaskRef,
      remoteFilesRef,
      cancelPendingFileMask: () => {},
      cancelPendingQuery: () => {
        queryFallbackCancelled += 1;
        queryAbort.abort();
      },
      requestFiles: (includeNonProject, fileMask) => {
        requests.push({ includeNonProject, fileMask });
      },
      setSearchEverywhere(update) {
        state = typeof update === 'function' ? update(state) : update;
      },
    },
  );

  updateFileMask('*.ts', false);

  assert.equal(fileMaskRef.current, '*.ts');
  assert.equal(queryFallbackCancelled, 1);
  assert.equal(queryAbort.signal.aborted, true);
  assert.deepEqual(remoteFilesRef.current, []);
  assert.equal(state.fileMask, '*.ts');
  assert.deepEqual(requests, []);

  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.deepEqual(requests, [{ includeNonProject: false, fileMask: '*.ts' }]);
});

test('Search Everywhere scope toggle cancels a pending File Mask refresh', async () => {
  const requests = [];
  let state = {
    includeNonProject: false,
    fileMask: '*.ts',
    files: [],
    filesScope: false,
    filesTruncated: false,
    error: null,
  };
  const timerRef = {
    current: setTimeout(() => requests.push('stale-mask-refresh'), 100),
  };
  const toggleIncludeNonProject = loadTypeScriptCallback(
    workspaceSource,
    'toggleIncludeNonProject',
    {
      searchEverywhere: state,
      abortSearchEverywhereFileRequests: () => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      },
      requestSearchEverywhereFiles: (includeNonProject, fileMask) => {
        requests.push({ includeNonProject, fileMask });
      },
      setSearchEverywhere(update) {
        state = typeof update === 'function' ? update(state) : update;
      },
    },
  );

  toggleIncludeNonProject();
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.deepEqual(requests, [{ includeNonProject: true, fileMask: '*.ts' }]);
  assert.equal(timerRef.current, null);
});

test('Search Everywhere searches beyond the truncated base file candidates', async () => {
  const requests = [];
  let state = {
    query: 'beyond-cap',
    includeNonProject: false,
    fileMask: '',
    files: [{ path: 'src/app.ts' }],
    filesScope: false,
    filesTruncated: true,
    error: null,
    errorSource: null,
  };
  const requestHostQueryFiles = loadTypeScriptCallback(fileCandidatesSource, 'requestHostQueryFiles', {
    queryRequestRef: { current: 0 },
    queryAbortRef: { current: null },
    currentQueryRef: { current: 'beyond-cap' },
    filesRef: { current: [{ path: 'src/app.ts' }] },
    truncatedRef: { current: true },
    scopeRef: { current: false },
    fileMaskRef: { current: '' },
    remoteFilesRef: { current: [] },
    mergeFileCandidates,
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async (payload, options) => {
      requests.push({ payload, signal: options.signal });
      return {
        entries: [{ path: 'vendor/beyond-cap.ts', name: 'beyond-cap.ts', kind: 'file' }],
        truncated: false,
      };
    },
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    searchTextFailureMessage,
    t,
  });

  requestHostQueryFiles('beyond-cap', false, '');
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].payload.op, 'search');
  assert.equal(requests[0].payload.query, 'beyond-cap');
  assert.deepEqual(state.files, [{ path: 'src/app.ts' }, { path: 'vendor/beyond-cap.ts' }]);
});

test('Search Everywhere query edits schedule the host fallback', () => {
  const scheduled = [];
  let state = {
    query: '',
    files: [],
    filesTruncated: true,
  };
  const updateQuery = loadTypeScriptCallback(fileCandidatesSource, 'updateQuery', {
    currentQueryRef: { current: '' },
    scheduleHostQuery: (query) => scheduled.push(query),
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
  });

  updateQuery('beyond-cap');

  assert.equal(state.query, 'beyond-cap');
  assert.equal(state.index, 0);
  assert.deepEqual(scheduled, ['beyond-cap']);
});

test('Search Everywhere restores base files when the query is cleared', async () => {
  let state = {
    query: 'beyond-cap',
    includeNonProject: false,
    fileMask: '',
    files: [{ path: 'src/app.ts' }, { path: 'vendor/beyond-cap.ts' }],
    filesScope: false,
    filesTruncated: true,
    error: null,
    errorSource: null,
  };
  const abort = new AbortController();
  const scheduleHostQuery = loadTypeScriptCallback(fileCandidatesSource, 'scheduleHostQuery', {
    queryTimerRef: { current: null },
    queryRequestRef: { current: 1 },
    queryAbortRef: { current: abort },
    currentQueryRef: { current: 'beyond-cap' },
    cancelPendingQuery: () => {
      abort.abort();
    },
    filesRef: { current: [{ path: 'src/app.ts' }] },
    truncatedRef: { current: true },
    scopeRef: { current: false },
    fileMaskRef: { current: '' },
    remoteFilesRef: { current: [{ path: 'vendor/beyond-cap.ts' }] },
    setSearchEverywhere(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs: async () => ({ entries: [], truncated: false }),
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
    searchTextFailureMessage,
    t,
  });

  scheduleHostQuery('');

  assert.equal(abort.signal.aborted, true);
  assert.deepEqual(state.files, [{ path: 'src/app.ts' }]);
});
