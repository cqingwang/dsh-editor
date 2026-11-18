import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

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

const treeSearchMiss = load('treeSearchMiss');

test('a search that only keeps the root row counts as a miss', () => {
  /* The root row is always kept by `filterTreeRows`, so `length <= 1` was a proxy
     for "nothing matched". Counting the actual rows says it directly. */
  assert.equal(treeSearchMiss({ query: 'zzz', rows: [{ path: '' }] }), true);
  assert.equal(treeSearchMiss({ query: 'zzz', rows: [] }), true);
});

test('a hit (or an empty query) is not a miss', () => {
  assert.equal(treeSearchMiss({ query: 'graph', rows: [{ path: '' }, { path: 'graph.ts' }] }), false);
  assert.equal(treeSearchMiss({ query: '', rows: [{ path: '' }] }), false);
  assert.equal(treeSearchMiss({ query: '   ', rows: [{ path: '' }] }), false);
});

test('the empty state is driven by the helper, not by a length guess', () => {
  assert.match(source, /treeSearchMiss\(/);
  const start = source.indexOf('treeSearchMiss(');
  const block = source.slice(start, start + 400);
  assert.match(block, /editor\.noMatches/);
  /* The old proxy must be gone. */
  assert.doesNotMatch(source, /search !== '' && visibleRows\.length <= 1/);
});
