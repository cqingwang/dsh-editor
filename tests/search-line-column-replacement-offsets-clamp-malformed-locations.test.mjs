import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
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
  assert.match(source, /function commitFindToolDirtyPlans\(plans\)/);
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
  assert.match(replaceOne, /dirtyFile === undefined \? await callFs/);
  assert.match(replaceOne, /dirtyFile !== undefined/);
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
