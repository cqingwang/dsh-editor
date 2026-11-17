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

const guideKind = load('guideKind');

test('the last child of a subtree ends without drawing an elbow', () => {
  assert.equal(guideKind({ continues: [true, false], index: 1, depth: 2 }), 'none');
  assert.equal(guideKind({ continues: [false], index: 0, depth: 1 }), 'none');
});

test('an ancestor that still has siblings keeps the full line', () => {
  assert.equal(guideKind({ continues: [true, true], index: 0, depth: 2 }), 'line');
  assert.equal(guideKind({ continues: [true], index: 0, depth: 1 }), 'line');
});

test('the renderer maps those kinds to the guide styles', () => {
  assert.match(source, /guideKind\(/);
  assert.match(source, /kind === 'line' \? styles\.indentGuide : styles\.indentGuideStop/);
  assert.doesNotMatch(source, /indentGuideCorner/);
});
