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

const restoreScrollTop = load('restoreScrollTop');

test('a remembered offset is restored and clamped to the new content', () => {
  assert.equal(restoreScrollTop({ remembered: 320, max: 900 }), 320);
  assert.equal(restoreScrollTop({ remembered: 5000, max: 900 }), 900);
  assert.equal(restoreScrollTop({ remembered: -10, max: 900 }), 0);
});

test('an unknown offset leaves the scroller alone', () => {
  /* `null` means "never visited this tab": jumping to 0 would be wrong. */
  assert.equal(restoreScrollTop({ remembered: null, max: 900 }), null);
  assert.equal(restoreScrollTop({ remembered: Number.NaN, max: 900 }), null);
  assert.equal(restoreScrollTop(null), null);
});

test('the commit panel keeps one offset per tab', () => {
  assert.match(source, /commitScrollRef/);
  assert.match(source, /restoreScrollTop\(/);
  /* Switching tabs records the outgoing position before the new tab renders. */
  assert.match(source, /rememberCommitScroll\(/);
});
