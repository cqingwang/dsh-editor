import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const quickOpen = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Quick Open merges persisted-index query hits without duplicating base paths', () => {
  const merge = loadTypeScriptFunction(
    quickOpen.slice(
      quickOpen.indexOf('export function mergeQuickOpenFiles('),
      quickOpen.indexOf('\n}\n', quickOpen.indexOf('export function mergeQuickOpenFiles(')) + 2,
    ),
    'mergeQuickOpenFiles',
  );
  assert.deepEqual(merge(['a.ts', 'b.ts'], ['b.ts', 'nested/c.ts']), ['a.ts', 'b.ts', 'nested/c.ts']);
});

test('Quick Open only asks the Host for a non-empty truncated query', () => {
  const needsQuery = loadTypeScriptFunction(
    quickOpen.slice(
      quickOpen.indexOf('export function quickOpenNeedsHostQuery('),
      quickOpen.indexOf('\n}\n', quickOpen.indexOf('export function quickOpenNeedsHostQuery(')) + 2,
    ),
    'quickOpenNeedsHostQuery',
  );
  assert.equal(needsQuery('target', true), true);
  assert.equal(needsQuery('   ', true), false);
  assert.equal(needsQuery('target', false), false);
});

test('Quick Open query fallback forwards path matching and replaces its truncated state', () => {
  assert.match(quickOpen, /op: 'search',[\s\S]*?matchPath: true,[\s\S]*?searchDirectoryRules,/);
  assert.match(quickOpen, /matchPath: true,\s+filesOnly: true,/);
  assert.match(quickOpen, /truncated: value\?\.truncated === true/);
  assert.match(workspace, /useQuickOpenFileCandidates\(\{ setQuickOpen, searchDirectoryRules, t \}\)/);
  assert.match(workspace, /paletteMode === 'files'\s+\? quickOpenFileCandidates\.updateQuery\(query\)/);
});

test('a truncated Quick Open query merges Host results beyond its base files', async () => {
  let state = {
    query: 'target',
    index: 0,
    files: ['base.ts'],
    truncated: true,
    loading: false,
    error: null,
  };
  const requests = [];
  const requestHostQuery = loadTypeScriptCallback(quickOpen, 'requestHostQuery', {
    queryRequestRef: { current: 0 },
    queryAbortRef: { current: null },
    currentQueryRef: { current: 'target' },
    filesRef: { current: ['base.ts'] },
    truncatedRef: { current: true },
    remoteFilesRef: { current: [] },
    restoreBaseFiles: () => {},
    quickOpenNeedsHostQuery: (query, truncated) => truncated && query.trim() !== '',
    mergeQuickOpenFiles: (base, extra) => [...new Set([...base, ...extra])],
    callFs: async (payload) => {
      requests.push(payload);
      return {
        entries: [
          { path: 'base.ts', kind: 'file' },
          { path: 'nested/target.ts', kind: 'file' },
        ],
        truncated: false,
      };
    },
    searchTextFailureMessage: (_failure, t) => t('editor.searchQuickOpenFailed'),
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    setQuickOpen(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    t: (key) => key,
  });

  requestHostQuery('target');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests[0].op, 'search');
  assert.equal(requests[0].matchPath, true);
  assert.deepEqual(state.files, ['base.ts', 'nested/target.ts']);
  assert.equal(state.truncated, false);
});
