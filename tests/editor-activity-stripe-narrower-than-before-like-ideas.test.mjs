import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

/** Evaluate one shipping helper by brace balance. */
function load(name, extra = '') {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${extra}${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the activity stripe is narrower than before, like IDEA\'s', () => {
  const start = source.indexOf('      stripe: {');
  const block = source.slice(start, source.indexOf('      stripeItem: {', start));
  const width = /flex: '0 0 (\d+)px'/.exec(block);
  assert.notEqual(width, null, 'the stripe needs an explicit width');
  /* IDEA's stripe is ~40px; it was 42 and now has to be a little tighter. */
  assert.ok(Number(width[1]) <= 38, `stripe width ${width[1]} should be at most 38px`);
  assert.match(block, new RegExp(`width: ${width[1]},`));
});

test('the stripe items shrink with it and keep their labels readable', () => {
  const start = source.indexOf('      stripeItem: {');
  const block = source.slice(start, source.indexOf('      stripeItemActive: {', start));
  const minHeight = /minHeight: (\d+)/.exec(block);
  assert.notEqual(minHeight, null);
  assert.ok(Number(minHeight[1]) <= 56, `item minHeight ${minHeight[1]} should be at most 56`);
});

/** `splitRootLabel` delegates to `abbreviatePath`; both must share one scope. */
function loadSplitRootLabel() {
  const at = (name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing`);
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
  };
  return new Function(`${at('abbreviatePath')}\n${at('splitRootLabel')}; return splitRootLabel;`)();
}

const splitRootLabel = loadSplitRootLabel();

test('the project root label keeps the folder name and gives up the path', () => {
  /* In a narrow tool window the path (~/Documents/project/doc) used to squeeze the
     folder name to an ellipsis; IDEA keeps the name and truncates the path. */
  const parts = splitRootLabel('/Users/chan/Documents/project/doc', '/Users/chan');
  assert.equal(parts.name, 'doc');
  assert.equal(parts.path, '~/Documents/project/doc');
});

test('a root outside the home directory keeps an absolute path', () => {
  const parts = splitRootLabel('/opt/work/app', '/Users/chan');
  assert.equal(parts.name, 'app');
  assert.equal(parts.path, '/opt/work/app');
});

test('the root row renders name and path as separate, shrinkable spans', () => {
  const start = source.indexOf("...(row.root ? styles.treeRootLabel : null)");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3200);
  /* Only the path may shrink; the name is `flex: none`. */
  assert.match(block, /styles\.treeRootLabel/);
  assert.match(block, /styles\.treeRootPath/);
  assert.match(block, /splitRootLabel\(root, home\)\.path/);
});
