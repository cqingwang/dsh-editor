import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Commit Log selection initializes and persists one stable hash', () => {
  assert.match(workspaceSource, /readStoredText\('dsh-editor\.commit\.selected', ''\)/u);
  assert.match(workspaceSource, /writeStoredText\('dsh-editor\.commit\.selected', selectedCommit \?\? ''\)/u);
  assert.match(workspaceSource, /selectedCommitRequestRef\.current = hash;/u);
});

test('restored Commit Log selection is shown only when present in loaded commits', () => {
  assert.match(
    workspaceSource,
    /if \(!commits\.some\(\(commit\) => commit\.hash === selectedCommit\)\) \{[\s\S]*?if \(!logLoading && logExhausted\) \{[\s\S]*?selectedCommitRequestRef\.current = null;[\s\S]*?setSelectedCommit\(null\);[\s\S]*?setLogDetail\(null\);/u,
  );
  assert.match(
    workspaceSource,
    /if \(logDetail\?\.hash === selectedCommit\) return;[\s\S]*?if \(selectedCommitRequestRef\.current === selectedCommit\) return;[\s\S]*?void showCommit\(selectedCommit\);/u,
  );
});
