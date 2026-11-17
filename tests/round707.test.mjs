import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const replaceInFiles = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);

test('Search Everywhere records dirty before/after content for unified Undo', () => {
  assert.match(replaceInFiles, /const dirtyUndo = dirtyPlans\.map/u);
  assert.match(replaceInFiles, /beforeContent: plan\.model\.getValue\(\)/u);
  assert.match(replaceInFiles, /afterContent: plan\.text/u);
});

test('Search Everywhere Replace All publishes a bounded Find undo operation', () => {
  assert.match(replaceInFiles, /const operationId = typeof value\?\.operationId === 'string'/u);
  assert.match(replaceInFiles, /const operation = \{/u);
  assert.match(replaceInFiles, /clean: operationId !== '' && hostChanged\.length > 0/u);
  assert.match(replaceInFiles, /dirty: dirtyUndo/u);
  assert.match(replaceInFiles, /files: changed/u);
  assert.match(replaceInFiles, /replacements: replacedCount/u);
  assert.match(replaceInFiles, /setFindReplaceRedoStack\(\[\]\)/u);
  assert.match(replaceInFiles, /setFindReplaceUndoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\)/u);
});

test('Search Everywhere keeps dirty Monaco undo independent from host history', () => {
  assert.match(replaceInFiles, /const dirtyCommit = commitFindToolDirtyPlans\(dirtyPlans\)/u);
  const commitIndex = replaceInFiles.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  const openFilesIndex = replaceInFiles.indexOf('setOpenFiles((current) => current.map((file) =>');
  assert.ok(commitIndex >= 0);
  assert.ok(openFilesIndex > commitIndex);
});

test('Replace attempt is released exactly once on every terminal path', () => {
  const releases = replaceInFiles.match(/releaseReplaceAttempt\(replaceWriteBusyRef\)/gu) ?? [];
  assert.equal(releases.length, 2);
  assert.match(replaceInFiles, /finally \{\s+releaseReplaceAttempt\(replaceWriteBusyRef\);\s+\}/u);
});
