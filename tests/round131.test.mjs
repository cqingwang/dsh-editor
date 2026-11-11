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

/** `treeNameColor` delegates the porcelain mapping; both must share one scope. */
function loadTreeNameColor() {
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
  return new Function(`${at('gitStatusInfo')}\n${at('treeNameColor')}; return treeNameColor;`)();
}

const treeNameColor = loadTreeNameColor();

test('a changed file is tinted, with no letter', () => {
  /* The letter is IDEA's FILE ICON for Markdown, not a git marker: the tree colours
     the name for both files and folders and never stamps M/A/D. */
  assert.equal(treeNameColor({ status: ' M', selected: false }), '#2f65ca');
  assert.equal(treeNameColor({ status: 'A ', selected: false }), '#1a7f37');
  assert.equal(treeNameColor({ status: ' D', selected: false }), '#cf222e');
  assert.equal(treeNameColor({ status: '??', selected: false }), '#6e7781');
});

test('a clean file keeps the default colour, and a selected row is white', () => {
  assert.equal(treeNameColor({ status: undefined, selected: false }), null);
  assert.equal(treeNameColor({ status: ' M', selected: true }), '#fff');
});

test('conflicts outrank a plain modification', () => {
  assert.equal(treeNameColor({ status: 'UU', selected: false }), '#cf222e');
});

test('the tree row no longer renders a status badge', () => {
  const start = source.indexOf('onDrop(sources, row.path);');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1600);
  assert.doesNotMatch(block, /GitStatusBadge/);
  /* ...but the Commit page and the palette still use it. */
  assert.ok(source.split('GitStatusBadge').length - 1 >= 2, 'the badge is still used elsewhere');
});
