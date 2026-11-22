import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/commit/commit-log-view-model.ts', import.meta.url),
  'utf8',
);
const shouldLoadCommitLogOnOpen = loadTypeScriptFunction(source, 'shouldLoadCommitLogOnOpen');

const ready = {
  activity: 'commit',
  authorReady: true,
  panelVisible: true,
  mode: 'log',
  gitReady: true,
  isRepo: true,
  commitCount: 0,
  exhausted: false,
  loading: false,
  failed: false,
};

test('restored Log tab starts its first request without waiting for a mode change', () => {
  assert.equal(shouldLoadCommitLogOnOpen(ready), true);
});

test('initial Log load avoids duplicate requests and non-Log surfaces', () => {
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, activity: 'project' }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, authorReady: false }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, panelVisible: false }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, mode: 'changes' }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, gitReady: false }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, isRepo: false }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, commitCount: 1 }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, exhausted: true }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, loading: true }), false);
  assert.equal(shouldLoadCommitLogOnOpen({ ...ready, failed: true }), false);
});
