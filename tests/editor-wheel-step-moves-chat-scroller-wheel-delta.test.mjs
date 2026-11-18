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

const wheelScrollTop = load('wheelScrollTop');

test('a wheel step moves the chat scroller by the wheel delta', () => {
  /* The flow's message nodes consume the wheel before it reaches the scroll
     container, so the plugin drives the scroll itself. */
  assert.equal(wheelScrollTop({ scrollTop: 400, deltaY: -120, max: 900 }), 280);
  assert.equal(wheelScrollTop({ scrollTop: 400, deltaY: 120, max: 900 }), 520);
});

test('the result is clamped to the scrollable range', () => {
  assert.equal(wheelScrollTop({ scrollTop: 10, deltaY: -500, max: 900 }), 0);
  assert.equal(wheelScrollTop({ scrollTop: 880, deltaY: 500, max: 900 }), 900);
  assert.equal(wheelScrollTop({ scrollTop: 0, deltaY: -1, max: 0 }), 0);
});

test('a junk delta leaves the position alone', () => {
  assert.equal(wheelScrollTop({ scrollTop: 100, deltaY: Number.NaN, max: 900 }), 100);
  assert.equal(wheelScrollTop(null), null);
});

test('the split installs a wheel bridge on the chat scroller', () => {
  assert.match(source, /data-dsh-chat-wheel/);
  assert.match(source, /function ensureChatWheel\(/);
  assert.match(source, /wheelScrollTop\(/);
});
