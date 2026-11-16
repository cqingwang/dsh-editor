import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const planWorkspaceReplacements = new Function(
  `${extract('editorFindResult')}\n${extract('editorApplyPreserveCase')}\n`
  + `${extract('editorRegexReplacementText')}\n${extract('editorReplaceAt')}\n`
  + `${extract('editorReplaceAll')}\n${extract('planWorkspaceReplacements')}\n`
  + 'return planWorkspaceReplacements;',
)();

test('Mixed replacement planning partitions dirty and clean targets without mutating models', () => {
  const model = { getValue: () => 'Token one Token two' };
  const matches = [
    { path: 'dirty.txt', line: 1, column: 1 },
    { path: 'dirty.txt', line: 1, column: 11 },
    { path: 'clean.txt', line: 2, column: 3, mtime: 123 },
  ];
  const plan = planWorkspaceReplacements(
    matches,
    [{ path: 'dirty.txt', dirty: true }, { path: 'clean.txt', dirty: false }],
    new Map([['dirty.txt', model]]),
    'Token',
    'Token_DONE',
    { preserveCase: false },
  );
  assert.equal(plan.errorPath, null);
  assert.equal(plan.errorMessage, null);
  assert.deepEqual(plan.dirtyMatches.map((match) => match.path), ['dirty.txt', 'dirty.txt']);
  assert.deepEqual(plan.cleanMatches.map((match) => match.path), ['clean.txt']);
  assert.deepEqual([...plan.cleanTargets.keys()], ['clean.txt']);
  assert.deepEqual(plan.dirtyPlans.map((item) => [item.path, item.text, item.count]), [
    ['dirty.txt', 'Token_DONE one Token_DONE two', 2],
  ]);
  assert.equal(model.getValue(), 'Token one Token two');
});

test('Missing dirty models and invalid regexes fail during preflight', () => {
  const missing = planWorkspaceReplacements(
    [{ path: 'dirty.txt' }],
    [{ path: 'dirty.txt', dirty: true }],
    new Map(),
    'Token',
    'Next',
    {},
  );
  assert.equal(missing.errorPath, 'dirty.txt');
  assert.equal(missing.errorMessage, null);
  assert.deepEqual(missing.dirtyPlans, []);

  const invalid = planWorkspaceReplacements(
    [{ path: 'dirty.txt' }],
    [{ path: 'dirty.txt', dirty: true }],
    new Map([['dirty.txt', { getValue: () => 'Token' }]]),
    '[',
    'Next',
    { regex: true },
  );
  assert.equal(invalid.errorPath, null);
  assert.match(invalid.errorMessage, /invalid regular expression/);
  assert.deepEqual(invalid.dirtyPlans, []);
});

test('Search Everywhere and Find both call the shared replacement planner', () => {
  assert.match(source, /const replacementPlan = planWorkspaceReplacements\(\s*matches,\s*openFilesRef\.current,\s*modelsRef\.current,\s*query,\s*replacement/s);
  assert.match(source, /const replacementPlan = planWorkspaceReplacements\(\s*matches,\s*openFilesRef\.current,\s*modelsRef\.current,\s*query,\s*findTool\.replace/s);
});
