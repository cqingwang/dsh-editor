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

const describeMoveResult = load('describeMoveResult');

test('a clean batch move reports how many entries landed', () => {
  /* A drag that silently does nothing looks the same as one that moved five files. */
  assert.deepEqual(describeMoveResult({ moved: ['a.ts'], conflicts: [], target: 'src' }), { done: 1, target: 'src' });
  assert.deepEqual(describeMoveResult({ moved: ['a.ts', 'b.ts'], conflicts: [], target: '' }), { done: 2, target: '' });
});

test('a partial move still reports what succeeded', () => {
  const result = describeMoveResult({ moved: ['a.ts', 'b.ts'], conflicts: [{ to: 'src/c.ts' }], target: 'src' });
  assert.equal(result.done, 2);
  assert.equal(result.blocked, 'src/c.ts');
});

test('nothing moved means no success message', () => {
  assert.equal(describeMoveResult({ moved: [], conflicts: [{ to: 'x' }], target: '' }).done, 0);
  assert.equal(describeMoveResult(null), null);
});

test('the drag reports success in the tree, not only on failure', () => {
  assert.match(source, /describeMoveResult\(/);
  assert.match(source, /editor\.movedCount/);
});
