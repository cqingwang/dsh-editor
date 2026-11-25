import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/ui/commit-model.ts'), 'utf8');
const nearest = loadTypeScriptFunction(source, 'nearestRowAfterRemoval');
const selectionKey = loadTypeScriptFunction(source, 'changeSelectionKey');
const reconcile = loadTypeScriptFunction(source, 'reconcileChangeSelectionModel');

test('change selection keys keep staged and working-tree rows distinct', () => {
  assert.equal(selectionKey('src/app.ts', true), 'staged:src/app.ts');
  assert.equal(selectionKey('src/app.ts', false), 'unstaged:src/app.ts');
});

test('nearest surviving row prefers the next row after a middle removal', () => {
  assert.equal(
    nearest(
      ['staged:a.txt', 'unstaged:b.txt', 'unstaged:c.txt', 'unstaged:d.txt'],
      new Set(['staged:a.txt', 'unstaged:c.txt', 'unstaged:d.txt']),
      new Set(['unstaged:b.txt']),
    ),
    'unstaged:c.txt',
  );
});

test('nearest surviving row falls back to the previous row at the end', () => {
  assert.equal(
    nearest(
      ['staged:a.txt', 'unstaged:b.txt', 'unstaged:c.txt'],
      new Set(['staged:a.txt', 'unstaged:b.txt']),
      new Set(['unstaged:c.txt']),
    ),
    'unstaged:b.txt',
  );
});

test('nearest surviving row handles first, all and no removals', () => {
  assert.equal(
    nearest(['staged:a.txt', 'unstaged:b.txt'], new Set(['unstaged:b.txt']), new Set(['staged:a.txt'])),
    'unstaged:b.txt',
  );
  assert.equal(nearest(['staged:a.txt'], new Set(), new Set(['staged:a.txt'])), null);
  assert.equal(
    nearest(['staged:a.txt', 'unstaged:b.txt'], new Set(['staged:a.txt', 'unstaged:b.txt']), new Set()),
    'staged:a.txt',
  );
});

test('reconciliation keeps surviving rows and moves the primary to the nearest survivor', () => {
  const result = reconcile(
    ['staged:a.txt', 'unstaged:b.txt', 'unstaged:c.txt'],
    new Set(['staged:a.txt', 'unstaged:b.txt']),
    new Set(['unstaged:b.txt', 'unstaged:c.txt']),
    new Set(['unstaged:c.txt']),
  );
  assert.deepEqual([...result.selection], ['unstaged:b.txt']);
  assert.equal(result.primary, 'unstaged:b.txt');
});

test('reconciliation follows a row that moved to the other git band', () => {
  const stagedToWorking = reconcile(
    ['staged:src/app.ts', 'unstaged:.idea/workspace.xml'],
    new Set(['unstaged:src/app.ts', 'unstaged:.idea/workspace.xml']),
    new Set(['staged:src/app.ts']),
    new Set(['staged:src/app.ts']),
  );
  assert.deepEqual([...stagedToWorking.selection], ['unstaged:src/app.ts']);
  assert.equal(stagedToWorking.primary, 'unstaged:src/app.ts');

  const workingToStaged = reconcile(
    ['staged:src/app.ts', 'unstaged:src/app.ts'],
    new Set(['staged:src/app.ts']),
    new Set(['unstaged:src/app.ts']),
    new Set(['unstaged:src/app.ts']),
  );
  assert.deepEqual([...workingToStaged.selection], ['staged:src/app.ts']);
  assert.equal(workingToStaged.primary, 'staged:src/app.ts');
});
