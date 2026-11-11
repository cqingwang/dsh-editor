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

const isNearBottom = load('isNearBottom');

test('a scroller within the bottom threshold counts as "following"', () => {
  /* The slack is 24px: anything within that is "following", further back is not. */
  assert.equal(isNearBottom({ scrollTop: 990, max: 1000 }), true);
  assert.equal(isNearBottom({ scrollTop: 1000, max: 1000 }), true);
  assert.equal(isNearBottom({ scrollTop: 900, max: 1000 }), false);
  assert.equal(isNearBottom({ scrollTop: 400, max: 1000 }), false);
});

test('a short conversation is always "at the bottom"', () => {
  /* Nothing to scroll: following is trivially true, and the first paint should not
     jump a short chat around. */
  assert.equal(isNearBottom({ scrollTop: 0, max: 0 }), true);
  assert.equal(isNearBottom(null), true);
});

test('the split sticks the chat to the newest message after layout settles', () => {
  assert.match(source, /data-dsh-chat-pinned/);
  assert.match(source, /function pinChatToBottom\(/);
  assert.match(source, /isNearBottom\(/);
});

test('the first pin ignores the follow test, later pins honour it', () => {
  /* Before the first pin the user cannot have scrolled: the flow mounts at offset 0
     with the newest message off-screen. After that, a deliberate scroll-up wins. */
  const start = source.indexOf('function pinChatToBottom(container)');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /firstPin/);
  assert.match(block, /if \(!firstPin && !isNearBottom\(/);
  assert.match(block, /area\.scrollTop = max;/);
});
