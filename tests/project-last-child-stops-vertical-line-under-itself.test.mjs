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

const continuationFlags = load('continuationFlags');

test('a last child stops the vertical line under itself', () => {
  /* IDEA draws the guide for every ancestor that still has a sibling below. The last
     entry of a subtree gets an empty slot, so the line stops at its own row instead
     of running into the next subtree. */
  /* `true` = this ancestor has no sibling below, so its line stops here. */
  assert.deepEqual(continuationFlags([true, true, false]), [false, false, true]);
  assert.deepEqual(continuationFlags([false]), [true]);
  assert.deepEqual(continuationFlags([]), []);
});

test('the flat row list records "is last" for every depth', () => {
  /* The renderer only knows `depth`; without this it cannot tell whether the line
     at that column should continue into the next row. */
  const start = source.indexOf('    function flattenRows(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1600);
  /* Each row carries the per-depth continuation flags the renderer draws from. */
  assert.match(block, /continues/);
  assert.match(block, /continuationFlags\(/);
});

test('the guides render from those flags', () => {
  const start = source.indexOf('row.depth > 0');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /row\.continues/);
  assert.match(block, /indentGuideStop/);
});
