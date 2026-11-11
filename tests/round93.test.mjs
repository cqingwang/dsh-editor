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

const menuArrowTarget = load('menuArrowTarget');

/* DOM order is: [our row, host item 1, host item 2]. The host's own arrow logic
   indexes only its own items, so it never lands on index 0. */
const SELF = 0;

test('↓ from the injected row steps into the host\'s first item', () => {
  assert.equal(menuArrowTarget(SELF, 'ArrowDown', SELF), 1);
});

test('↑ from the host\'s first item reaches the injected row', () => {
  /* The host's first item is DOM index 1; ↑ walks into our row. */
  assert.equal(menuArrowTarget(1, 'ArrowUp', SELF), 0);
});

test('when our row is not involved the host keeps the key', () => {
  /* 1↓ → 2 and 2↓/↑ stay inside the host's own list. */
  assert.equal(menuArrowTarget(1, 'ArrowDown', SELF), null);
  assert.equal(menuArrowTarget(2, 'ArrowDown', SELF), null);
  assert.equal(menuArrowTarget(2, 'ArrowUp', SELF), null);
  /* Nothing focused yet: the host focuses its own first row. */
  assert.equal(menuArrowTarget(-1, 'ArrowDown', SELF), null);
  /* ↑ from the top of the menu lands on our injected row (index 0). */
  assert.equal(menuArrowTarget(0, 'ArrowUp', SELF), 0);
  /* Other keys are not ours. */
  assert.equal(menuArrowTarget(SELF, 'Enter', SELF), null);
});

test('the injected row is wired into the menu\'s key handling', () => {
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 5200);
  assert.match(block, /menuArrowTarget\(/);
  assert.match(block, /addEventListener\('keydown'/);
  /* Enter on our row must do what clicking it does. */
  assert.match(block, /clone\.click\(\)/);
});
