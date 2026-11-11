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

const jumpBadgeVisible = load('jumpBadgeVisible');

test('the "jump to newest" badge only shows while the user is scrolled away', () => {
  /* At the bottom there is nothing to jump to; showing the badge there is noise. */
  assert.equal(jumpBadgeVisible({ scrollTop: 400, max: 1000, hasNew: true }), true);
  assert.equal(jumpBadgeVisible({ scrollTop: 1000, max: 1000, hasNew: true }), false);
  assert.equal(jumpBadgeVisible({ scrollTop: 990, max: 1000, hasNew: true }), false);
});

test('no badge without something new to show', () => {
  assert.equal(jumpBadgeVisible({ scrollTop: 400, max: 1000, hasNew: false }), false);
  assert.equal(jumpBadgeVisible(null), false);
  /* A conversation that does not scroll never needs it. */
  assert.equal(jumpBadgeVisible({ scrollTop: 0, max: 0, hasNew: true }), false);
});

test('the split renders the badge and wires it to the scroller', () => {
  assert.match(source, /data-dsh-chat-jump/);
  assert.match(source, /function ensureChatJump\(/);
  assert.match(source, /jumpBadgeVisible\(/);
});
