import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'),
].join('\n');
const replaceAll = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const replacementPlanner = source.slice(
  source.indexOf('function planWorkspaceReplacements('),
  source.indexOf('function claimReplaceAttempt('),
);

test('Mixed dirty and clean Replace All waits for clean host success before dirty edits', () => {
  const hostCall = replaceAll.indexOf('await callFs({');
  const dirtyCommit = replaceAll.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  assert.ok(hostCall >= 0 && dirtyCommit > hostCall);
  assert.match(replaceAll, /cleanTargets\.size === 0\s+\? null\s+: await callFs/);
  assert.match(replaceAll, /targets: \[\.\.\.cleanTargets\.values\(\)\]/);
});

test('Every dirty path is preflighted and changed file/replacement totals are merged', () => {
  assert.match(replaceAll, /const replacementPlan = planWorkspaceReplacements\(/);
  assert.match(replacementPlanner, /const dirtyPaths = \[\s*\.\.\.new Set\(dirtyMatches\.map\([\s\S]*?filter\(/u);
  assert.match(
    replacementPlanner,
    /dirtyPlans\.push\(\{ path, model, text: rewritten\.text, count: rewritten\.count \}\)/,
  );
  assert.match(replaceAll, /const dirtyReplacements = dirtyCommit\.count/);
  assert.match(replaceAll, /const dirtyUndo = dirtyReplaceUndo\(dirtyPlans\)/);
  assert.match(replaceAll, /replaceOperationState\(\s+value,\s+hostChanged,\s+dirtyChanged,\s+dirtyReplacements/u);
  assert.match(replaceAll, /searchReplaceCountParams\(t, replacedCount, changed\.length\)/);
});

test('Cancel and preflight failures cannot mutate dirty models', () => {
  const confirmAt = replaceAll.indexOf('confirmFindReplaceAndGeneration');
  const dirtyCommit = replaceAll.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  assert.ok(confirmAt >= 0 && dirtyCommit > confirmAt);
  assert.match(replaceAll, /replaceWriteBusyRef,[\s\S]*?setFindTool/u);
  assert.match(source, /function findToolReplaceAbortState[\s\S]*?replaceFocusRequest/u);
  assert.match(replacementPlanner, /if \(rewritten\.error !== null\)/);
});
