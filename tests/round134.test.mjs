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

const revealInTree = load('revealInTree');

test('Enter on an already-open folder keeps it open', () => {
  /* `onToggle` closes an open folder: pressing Enter to jump to a directory that was
     already expanded COLLAPSED it, the opposite of "take me there". */
  assert.equal(revealInTree({ kind: 'directory', open: true }), 'keep');
  assert.equal(revealInTree({ kind: 'directory', open: false }), 'expand');
});

test('a file hit is opened, not toggled', () => {
  assert.equal(revealInTree({ kind: 'file', open: false }), 'open');
  assert.equal(revealInTree({ kind: 'file', open: true }), 'open');
});

test('an unknown row is ignored', () => {
  assert.equal(revealInTree(null), 'none');
  assert.equal(revealInTree({}), 'none');
});

test('the search handler uses that decision instead of calling onToggle blindly', () => {
  const start = source.indexOf('const hit = hits.find');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /revealInTree\(/);
  /* The old unconditional toggle must be gone. */
  assert.doesNotMatch(block, /if \(hit\.kind === 'directory'\) onToggle\(hit\.path\);/);
});
