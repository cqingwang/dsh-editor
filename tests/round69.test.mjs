import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'lib/client.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'tests/fixtures/commit-graph.legacy.js'), 'utf8');

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

test('a first-parent chain collapses into one run', () => {
  /* IDEA's graph can fold "no other lane is alive" stretches; the collapsed row
     has to say how many commits it stands for. */
  const entries = [
    { hash: 'c3', parents: ['c2'] },
    { hash: 'c2', parents: ['c1'] },
    { hash: 'c1', parents: [] },
  ];
  const runs = linearRun(entries, new Map([['c3', 0], ['c2', 0], ['c1', 0]]));
  /* Three single-lane commits are ONE run: that is what folding squeezes. */
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].hashes, ['c3', 'c2', 'c1']);
  assert.equal(runs[0].lane, 0);
  assert.equal(runs[0].merge, false);
});

test('a merge breaks the run and a fork starts a new one', () => {
  const entries = [
    { hash: 'm1', parents: ['a1', 'b1'] },
    { hash: 'b1', parents: [] },
    { hash: 'a1', parents: [] },
  ];
  const lanes = new Map([['m1', 0], ['b1', 1], ['a1', 0]]);
  const runs = linearRun(entries, lanes);
  assert.equal(runs.length, 3);
  /* The merge row is its own run because it has two parents. */
  assert.equal(runs[0].merge, true);
});

test('the graph offers a collapsed view and says how many rows it hides', () => {
  const start = source.indexOf('function CommitGraph(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 5200);
  assert.match(block, /t\('editor\.graphFoldChains'\)/);
  assert.match(block, /t\('editor\.graphFoldedCount', \{ count:/);
  assert.match(block, /const lanes = assignGraphLanes\(entries\)/);
});
