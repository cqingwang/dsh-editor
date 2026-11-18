import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'),
].join('\n');
const replaceAll = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const replaceOne = source.slice(
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  source.indexOf('const dismissExternal = React.useCallback'),
);
const replacementPlanner = source.slice(
  source.indexOf('function planWorkspaceReplacements('),
  source.indexOf('function claimReplaceAttempt('),
);

test('Line/column replacement offsets clamp malformed locations', () => {
  const offsetAt = new Function(
    `${extractFunction('textOffsetAtLineColumn')}; return textOffsetAtLineColumn;`,
  )();
  const text = 'first\nsecond\nthird';
  assert.equal(offsetAt(text, 1, 1), 0);
  assert.equal(offsetAt(text, 2, 3), 8);
  assert.equal(offsetAt(text, 99, 99), text.length);
  assert.equal(offsetAt(text, 0, 1), null);
  assert.equal(offsetAt(text, 1, 0), null);
});

test('Replace All preflights dirty buffers and sends only clean targets to the host', () => {
  assert.match(replaceAll, /const replacementPlan = planWorkspaceReplacements\(/);
  assert.match(replacementPlanner, /const dirtyMatches/);
  assert.match(replacementPlanner, /const cleanMatches/);
  assert.match(replacementPlanner, /editorReplaceAll\(/);
  assert.match(replaceAll, /commitFindToolDirtyPlans\(dirtyPlans\)/);
  assert.match(source, /function commitFindToolDirtyPlans\(plans(?::\s*[^)]+)?\)(?::\s*[^{]+)?/);
  assert.match(source, /model\.pushStackElement\?\.\(\)/);
  assert.match(source, /model\.pushEditOperations/);
  assert.match(replaceAll, /targets: \[\.\.\.cleanTargets\.values\(\)\]/);
  assert.match(replaceAll, /dirtyReplacements/);
  assert.match(replaceAll, /\(value\?\.replacements \?\? 0\) \+ dirtyReplacements/);
});

test('Single Replace performs exact dirty-buffer replacement without disk fallback', () => {
  assert.match(replaceOne, /const dirtyFile = openFilesRef\.current\.find/);
  assert.match(replaceOne, /editorReplaceAt\(/);
  assert.match(replaceOne, /textOffsetAtLineColumn\(/);
  assert.match(replaceOne, /dirtyModel\.pushStackElement/);
  assert.match(replaceOne, /dirtyModel\.pushEditOperations/);
  assert.match(replaceOne, /dirtyFile === undefined\s+\? await callFs/);
  assert.match(replaceOne, /dirtyFile !== undefined/);
});

function extractFunction(name) {
  return transpileTypeScriptFunction(source, name);
}
