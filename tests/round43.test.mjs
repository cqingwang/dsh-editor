import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Load the shipping `assignGraphLanes` so lane geometry is asserted on real code.
 *
 * The function is pure, so a DOM-free test can prove that a branch's history
 * stays on one lane and that a merge forks — things a string assertion cannot.
 * @returns {Function} the shipping implementation.
 */
function loadLaneAssignment() {
  const start = source.indexOf('    function assignGraphLanes(');
  assert.notEqual(start, -1, 'assignGraphLanes is missing');
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return new Function(`${source.slice(start, index + 1)}; return assignGraphLanes;`)();
      }
    }
  }
  throw new Error('unbalanced braces in assignGraphLanes');
}

const assignGraphLanes = loadLaneAssignment();

test('a linear history stays on a single lane', () => {
  const { laneOf, laneCount } = assignGraphLanes([
    { hash: 'c3', parents: ['c2'] },
    { hash: 'c2', parents: ['c1'] },
    { hash: 'c1', parents: [] },
  ]);
  assert.equal(laneCount, 1);
  assert.deepEqual([...laneOf.values()], [0, 0, 0]);
});

test('a branch keeps its own lane and rejoins at the fork point', () => {
  /* git --topo-order emits both tips before the shared history. */
  const { laneOf, laneCount } = assignGraphLanes([
    { hash: 'm2', parents: ['m1'] },
    { hash: 'm1', parents: ['c0'] },
    { hash: 'f1', parents: ['c0'] },
    { hash: 'c0', parents: [] },
  ]);
  assert.equal(laneCount, 2);
  assert.equal(laneOf.get('m2'), 0);
  assert.equal(laneOf.get('m1'), 0);
  assert.equal(laneOf.get('f1'), 1);
  /* The fork point is claimed by main's first-parent chain, so the line continues. */
  assert.equal(laneOf.get('c0'), 0);
});

test('a merge opens a lane for its second parent', () => {
  const { laneOf, laneCount } = assignGraphLanes([
    { hash: 'mg', parents: ['a1', 'b1'] },
    { hash: 'a1', parents: ['base'] },
    { hash: 'b1', parents: ['base'] },
    { hash: 'base', parents: [] },
  ]);
  assert.equal(laneCount, 2);
  assert.equal(laneOf.get('mg'), 0);
  assert.equal(laneOf.get('a1'), 0);
  assert.equal(laneOf.get('b1'), 1);
  assert.equal(laneOf.get('base'), 0);
});

test('lanes are never reused for a different branch in the same graph', () => {
  const { laneOf, laneCount } = assignGraphLanes([
    { hash: 't1', parents: [] },
    { hash: 't2', parents: [] },
    { hash: 't3', parents: [] },
  ]);
  /* Three unrelated roots must not collapse onto one lane. */
  assert.equal(new Set([...laneOf.values()]).size, 3);
  assert.equal(laneCount, 3);
});

test('the graph draws one track per lane and marks the active one', () => {
  /* Round 69 kept the lane map but also needs the run grouping, so the result
     is bound once and `laneOf` is read from it. */
  assert.match(source, /const lanes = assignGraphLanes\(entries\);/);
  assert.match(source, /const laneOf = lanes\.laneOf;/);
  /* Only the columns up to this row's lane; trailing gutters would waste width. */
  assert.match(source, /Array\.from\(\{ length: lane \+ 1 \}/);
  assert.match(source, /index === lane\s+\? styles\.commitGraphTrackActive/);
  /* The row highlights the commit under the pointer so the lane stays findable. */
  assert.match(source, /onMouseEnter: \(\) => onSelect\?\.\(entry\.hash\)/);
  assert.match(source, /styles\.commitGraphRowActive/);
});
