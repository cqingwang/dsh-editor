import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/commit/commit-log-selection-restore.ts'), 'utf8');
const action = loadTypeScriptFunction(source, 'commitLogSelectionRestoreAction');

const base = {
  selectedCommit: 'old',
  commits: [{ hash: 'new' }],
  detailHash: null,
  loading: false,
  loadingMore: false,
  exhausted: false,
  failed: false,
  attempts: 0,
  maxAttempts: 10,
  requestHash: null,
};

test('restored commit outside the first page requests another page', () => {
  assert.equal(action(base), 'loadMore');
});

test('restore waits while a page request or detail request is in flight', () => {
  assert.equal(action({ ...base, loading: true }), 'wait');
  assert.equal(action({ ...base, loadingMore: true }), 'wait');
  assert.equal(action({ ...base, failed: true }), 'wait');
});

test('restore clears only after history is exhausted or the page budget is spent', () => {
  assert.equal(action({ ...base, exhausted: true }), 'clear');
  assert.equal(action({ ...base, attempts: 10 }), 'clear');
});

test('restore shows detail once the commit is loaded and no request owns it', () => {
  assert.equal(action({ ...base, commits: [{ hash: 'old' }] }), 'show');
  assert.equal(action({ ...base, commits: [{ hash: 'old' }], detailHash: 'old' }), 'none');
  assert.equal(action({ ...base, commits: [{ hash: 'old' }], requestHash: 'old' }), 'wait');
});

test('restore is inert without a selection or loaded commits', () => {
  assert.equal(action({ ...base, selectedCommit: null }), 'none');
  assert.equal(action({ ...base, commits: [] }), 'none');
});

test('restore is disabled while full-history search owns the list', () => {
  assert.match(source, /if \(options\.enabled === false\) return;/u);
  const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
  assert.match(workspace, /enabled: !logSearch\.searchMode,/u);
});
