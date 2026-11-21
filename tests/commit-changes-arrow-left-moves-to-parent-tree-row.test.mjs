import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const diffSource = await readFile(new URL('../src/client/diff.ts', import.meta.url), 'utf8');

test('ArrowLeft parent resolution walks to the nearest shallower change-tree row', () => {
  const parentChangeTreeRowIndex = loadTypeScriptFunction(diffSource, 'parentChangeTreeRowIndex');

  assert.equal(parentChangeTreeRowIndex([1, 2, 3, 2, 1], 2), 1);
  assert.equal(parentChangeTreeRowIndex([1, 2, 3, 2, 1], 3), 0);
  assert.equal(parentChangeTreeRowIndex([1, 2, 2], 2), 0);
});

test('top-level and invalid change-tree rows have no parent target', () => {
  const parentChangeTreeRowIndex = loadTypeScriptFunction(diffSource, 'parentChangeTreeRowIndex');

  assert.equal(parentChangeTreeRowIndex([1, 2], 0), null);
  assert.equal(parentChangeTreeRowIndex([1, 2], 9), null);
  assert.equal(parentChangeTreeRowIndex([], -1), null);
});
