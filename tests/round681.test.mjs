import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const guideKind = new Function(`${extract('guideKind')}\nreturn guideKind;`)();

test('Nested Project files do not render an L-shaped indent guide', () => {
  assert.equal(guideKind({ continues: [true, false], index: 1, depth: 2 }), 'none');
  assert.equal(guideKind({ continues: [false], index: 0, depth: 1 }), 'none');
  assert.doesNotMatch(source, /indentGuideCorner/u);
  assert.doesNotMatch(source, /borderBottomLeftRadius: 3/u);
});
