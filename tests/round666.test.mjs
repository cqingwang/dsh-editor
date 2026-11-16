import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const replaceInFiles = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);
const replacementPlanner = source.slice(
  source.indexOf('function planWorkspaceReplacements('),
  source.indexOf('function claimReplaceAttempt('),
);

test('Search Everywhere Replace All reuses dirty-model replacement instead of rejecting dirty files', () => {
  assert.doesNotMatch(replaceInFiles, /const dirty = \[[\s\S]*?searchReplaceDirty[\s\S]*?return;/);
  assert.match(replaceInFiles, /const replacementPlan = planWorkspaceReplacements\(/);
  assert.match(replacementPlanner, /const dirtyFiles = new Map/);
  assert.match(replacementPlanner, /const dirtyMatches = hitList\.filter/);
  assert.match(replacementPlanner, /const cleanMatches = hitList\.filter/);
  assert.match(replacementPlanner, /editorReplaceAll\(model\.getValue\(\), query, replacement/);
});

test('Search Everywhere replaces clean files through the host and commits dirty models transactionally', () => {
  const hostCall = replaceInFiles.indexOf('await callFs({');
  const dirtyCommit = replaceInFiles.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  assert.ok(hostCall >= 0);
  assert.ok(dirtyCommit > hostCall);
  assert.match(replaceInFiles, /targets: \[\.\.\.cleanTargets\.values\(\)\]/);
  assert.match(replaceInFiles, /const dirtyCommit = commitFindToolDirtyPlans\(dirtyPlans\)/);
  assert.match(replaceInFiles, /matches: \(value\?\.replacements \?\? 0\) \+ dirtyReplacements/);
});

test('The popup preserves replacement state and immediately re-searches after success', () => {
  assert.match(replaceInFiles, /textRevision: \(current\.textRevision \?\? 0\) \+ 1/);
  assert.match(replaceInFiles, /replaceBusy: false/);
  assert.match(replaceInFiles, /rememberCurrentSearchQuery\(query\)/);
  assert.match(replaceInFiles, /rememberCurrentReplacement\(replacement\)/);
});
