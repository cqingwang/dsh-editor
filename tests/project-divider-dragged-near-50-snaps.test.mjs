import assert from 'assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

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

const snapSplitPercent = load('snapSplitPercent');

test('a divider dragged near 50/50 snaps to it', () => {
  /* IDEA's splitters snap to the middle; without it the panes are always slightly
     uneven and no amount of care fixes it. */
  assert.equal(snapSplitPercent(50), 50);
  assert.equal(snapSplitPercent(47), 50);
  assert.equal(snapSplitPercent(53), 50);
});

test('a deliberate off-centre split is left alone', () => {
  assert.equal(snapSplitPercent(30), 30);
  assert.equal(snapSplitPercent(70), 70);
  assert.equal(snapSplitPercent(20), 20);
});

test('the snap never leaves the allowed range', () => {
  assert.equal(snapSplitPercent(5), 20);
  assert.equal(snapSplitPercent(95), 80);
  /* Junk keeps the default rather than producing NaN. */
  assert.equal(snapSplitPercent(Number.NaN), 50);
});

test('the drag applies the snap before committing the width', () => {
  assert.match(source, /snapSplitPercent\(/);
  const start = source.indexOf('const onMove = (moveEvent) => {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 500);
  assert.match(block, /setSplitPercent\(snapSplitPercent\(/);
});
