import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Commit Log selection initializes and persists one stable hash', () => {
  assert.match(workspaceSource, /React\.useState<string \| null>\(readStoredCommitSelection\)/u);
  assert.match(workspaceSource, /writeStoredCommitSelection\(selectedCommit\)/u);
  assert.match(workspaceSource, /selectedCommitRequestRef\.current = hash;/u);
});

test('restored Commit Log selection delegates restore and pagination to the shared hook', () => {
  assert.match(
    workspaceSource,
    /useCommitLogSelectionRestore\(\{[\s\S]*?selectedCommit,[\s\S]*?commits,[\s\S]*?maxAttempts: 10,[\s\S]*?loadMore: loadMoreLog,[\s\S]*?show: showCommit,/u,
  );
});

test('restored Commit Log selection also seeds the visible row selection', () => {
  assert.match(workspaceSource, /React\.useState<string\[\]>\(readStoredCommitSelectionList\)/u);
});
