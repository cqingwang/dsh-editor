import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const replaceAll = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);

test('A later dirty-model failure rolls earlier models back', async () => {
  const commit = new Function(
    `${transpileTypeScriptFunction(commitSource, 'commitFindToolDirtyPlans')}; return commitFindToolDirtyPlans;`,
  )();
  const a = fakeModel('original-a');
  const b = fakeModel('original-b', true);
  assert.throws(
    () => commit([
      { path: 'a.txt', model: a, text: 'changed-a', count: 2 },
      { path: 'b.txt', model: b, text: 'changed-b', count: 1 },
    ]),
    /simulated model failure/,
  );
  assert.equal(a.getValue(), 'original-a');
  assert.equal(b.getValue(), 'original-b');
  assert.ok(a.undoBoundaries >= 2);
  assert.ok(b.undoBoundaries >= 1);
});

test('Successful dirty commit returns one synchronised content set', () => {
  const commit = new Function(
    `${transpileTypeScriptFunction(commitSource, 'commitFindToolDirtyPlans')}; return commitFindToolDirtyPlans;`,
  )();
  const a = fakeModel('R654_TOKEN');
  const b = fakeModel('R654_TOKEN');
  const result = commit([
    { path: 'a.txt', model: a, text: 'R654_DONE', count: 1 },
    { path: 'b.txt', model: b, text: 'R654_DONE', count: 1 },
  ]);
  assert.deepEqual([...result.contents.entries()], [
    ['a.txt', 'R654_DONE'],
    ['b.txt', 'R654_DONE'],
  ]);
  assert.deepEqual(result.paths, ['a.txt', 'b.txt']);
  assert.equal(result.count, 2);
  assert.equal(a.getValue(), 'R654_DONE');
  assert.equal(b.getValue(), 'R654_DONE');
});

test('Replace All uses the dirty transaction after the host success boundary', () => {
  const hostCall = replaceAll.indexOf('await callFs({');
  const dirtyCommit = replaceAll.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  assert.ok(hostCall >= 0 && dirtyCommit > hostCall);
  assert.match(replaceAll, /const dirtyCommit = commitFindToolDirtyPlans\(dirtyPlans\)/);
  assert.doesNotMatch(
    replaceAll.slice(dirtyCommit),
    /for \(const plan of dirtyPlans\)/,
  );
});

function fakeModel(initial, fail = false) {
  let value = initial;
  return {
    undoBoundaries: 0,
    getValue: () => value,
    getFullModelRange: () => ({}),
    pushStackElement() {
      this.undoBoundaries += 1;
    },
    pushEditOperations(_selections, operations) {
      if (fail) throw new Error('simulated model failure');
      value = operations[0].text;
    },
  };
}

