import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const viewModel = read('src/client/components/commit/commit-log-view-model.ts');
const placement = loadTypeScriptFunction(viewModel, 'commitLogLoadMorePlacement');

const base = {
  graphMode: false,
  loading: false,
  exhausted: false,
  failed: false,
  commitCount: 60,
  visibleCount: 0,
};

test('a filtered empty page offers Load More instead of trapping older matches', () => {
  assert.equal(placement(base), 'no-matches');
  assert.equal(placement({ ...base, visibleCount: 3 }), 'footer');
});

test('Load More is hidden while loading, failed, exhausted or in Graph mode', () => {
  assert.equal(placement({ ...base, loading: true }), 'none');
  assert.equal(placement({ ...base, failed: true }), 'none');
  assert.equal(placement({ ...base, exhausted: true }), 'none');
  assert.equal(placement({ ...base, graphMode: true }), 'none');
  assert.equal(placement({ ...base, commitCount: 0 }), 'none');
});

test('CommitLogListState renders the explicit action and busy state', () => {
  const state = read('src/client/components/commit/CommitLogListState.tsx');
  assert.match(state, /commitLogLoadMorePlacement/u);
  assert.match(state, /className='dsh-editor-log-load-more'/u);
  assert.match(state, /onClick=\{\(\) => onLoadMore\?\.\(\)\}/u);
});

test('the workspace reuses the shared log loading state for Load More', () => {
  const workspace = read('src/client/editor-workspace.tsx');
  assert.match(workspace, /loadingMoreRef\.current = true;\s+setLogLoading\(true\);/u);
  assert.match(workspace, /loadingMoreRef\.current = false;\s+setLogLoading\(false\);/u);
});
