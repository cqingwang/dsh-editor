import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const replaceInFiles = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);

test('Search Everywhere records dirty before/after content for unified Undo', () => {
  assert.match(replaceInFiles, /const dirtyUndo = dirtyReplaceUndo\(dirtyPlans\)/u);
});

test('Search Everywhere Replace All publishes a bounded Find undo operation', () => {
  assert.match(replaceInFiles, /replaceOperationState\(/u);
  assert.match(replaceInFiles, /const \{ changed, operation, replacedCount \} = replaceOperationState/u);
  assert.match(replaceInFiles, /setFindReplaceRedoStack\(\[\]\)/u);
  assert.match(replaceInFiles, /setFindReplaceUndoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\)/u);
});

test('Search Everywhere keeps dirty Monaco undo independent from host history', () => {
  assert.match(replaceInFiles, /const dirtyCommit = commitFindToolDirtyPlans\(dirtyPlans\)/u);
  const commitIndex = replaceInFiles.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  const openFilesIndex = replaceInFiles.indexOf('setOpenFiles((current) =>');
  assert.ok(commitIndex >= 0);
  assert.ok(openFilesIndex > commitIndex);
});

test('Replace attempt is released exactly once on every terminal path', () => {
  const releases = replaceInFiles.match(/releaseReplaceAttempt\(replaceWriteBusyRef\)/gu) ?? [];
  assert.equal(releases.length, 1);
  assert.match(replaceInFiles, /confirmFindReplaceAndGeneration\(/u);
  assert.match(replaceInFiles, /finally \{\s+releaseReplaceAttempt\(replaceWriteBusyRef\);\s+\}/u);
});
