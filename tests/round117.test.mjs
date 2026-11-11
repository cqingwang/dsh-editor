import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const linearRun = load('linearRun');

const commit = (hash, parents = ['p']) => ({ hash, parents });
const lanes = (...pairs) => new Map(pairs);

test('a straight lane folds into one run', () => {
  /* The point of the fold: a stretch where nothing else is alive becomes one row. */
  const runs = linearRun([commit('a'), commit('b'), commit('c')], lanes(['a', 0], ['b', 0], ['c', 0]));
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].hashes, ['a', 'b', 'c']);
});

test('a run does not jump across another lane that came between', () => {
  /* Lanes 0,0,1,0: the third row is lane 0 again but the lane-1 row sits between
     them, so folding would draw one bar where the graph actually has a detour. */
  const runs = linearRun(
    [commit('a'), commit('b'), commit('c'), commit('d')],
    lanes(['a', 0], ['b', 0], ['c', 1], ['d', 0]),
  );
  assert.deepEqual(runs.map((run) => run.hashes), [['a', 'b'], ['c'], ['d']]);
});

test('a merge is never folded into its neighbours', () => {
  const runs = linearRun(
    [commit('a'), commit('m', ['p1', 'p2']), commit('c')],
    lanes(['a', 0], ['m', 0], ['c', 0]),
  );
  assert.deepEqual(runs.map((run) => run.hashes), [['a'], ['m'], ['c']]);
});
