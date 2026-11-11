import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function style(name) {
  const start = source.indexOf(`      ${name}: {`);
  assert.notEqual(start, -1, `${name} style is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the narrowed stripe keeps its label readable, not just its icon', () => {
  /* Round 82 took the rail from 42px to 36px. The vertical label has to fit that
     width or "Terminal" clips into a stroke; 11px + letterSpacing did not. */
  const text = style('stripeText');
  const size = /fontSize: (\d+)/.exec(text);
  assert.notEqual(size, null);
  assert.ok(Number(size[1]) <= 10, `stripe label font ${size[1]}px should be at most 10px`);
  assert.match(text, /letterSpacing: 0(\.\d+)?,/);
});

test('the item padding leaves room for the two-line icon + label', () => {
  const item = style('stripeItem');
  const gap = /gap: (\d+)/.exec(item);
  assert.notEqual(gap, null);
  assert.ok(Number(gap[1]) <= 3, `icon/label gap ${gap[1]}px should be at most 3px`);
});
