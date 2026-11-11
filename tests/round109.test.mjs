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

const jumpBadgeLabel = load('jumpBadgeLabel');

test('the badge counts the messages that arrived while scrolled away', () => {
  assert.equal(jumpBadgeLabel(0), '↓');
  assert.equal(jumpBadgeLabel(1), '↓ 1');
  assert.equal(jumpBadgeLabel(12), '↓ 12');
});

test('an absurd count is capped so the pill never grows without bound', () => {
  assert.equal(jumpBadgeLabel(150), '↓ 99+');
  /* Junk falls back to the plain arrow. */
  assert.equal(jumpBadgeLabel(Number.NaN), '↓');
  assert.equal(jumpBadgeLabel(-3), '↓');
});

test('the badge label is applied from the live count', () => {
  assert.match(source, /jumpBadgeLabel\(/);
  const start = source.indexOf('function updateChatJump(container)');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('\n      }', start));
  assert.match(block, /badge\.textContent/);
});

test('the badge writes only when the label actually changed', () => {
  /* `updateChatJump` runs from a MutationObserver, and writing `textContent`
     unconditionally is itself a mutation: the observer re-fired forever and the
     renderer hung as soon as the split opened a second time. */
  const start = source.indexOf('function updateChatJump(container)');
  const block = source.slice(start, source.indexOf('\n      }', start));
  assert.match(block, /if \(badge\.textContent !== label\) badge\.textContent = label;/);
  assert.doesNotMatch(block, /^\s*badge\.textContent = jumpBadgeLabel/mu);
});
