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

const directoryTint = load('directoryTint');

test('a folder is tinted by its worst change, with no letter', () => {
  /* IDEA colours a changed folder's name instead of stamping an M on it: the letter
     belongs to files, and a badge on a folder shifts every child's icon. */
  const conflict = directoryTint([{ path: 'src/a.ts', status: 'UU' }]);
  assert.equal(conflict.color, '#cf222e');
  assert.equal(conflict.label, undefined);
});

test('the precedence is conflict > deleted > added > renamed > modified', () => {
  const tint = (statuses) => directoryTint(statuses.map((status, index) => ({ path: `d/f${index}.ts`, status })));
  assert.equal(tint(['M', 'D']).color, '#cf222e');
  assert.equal(tint(['M', 'A']).color, '#1a7f37');
  assert.equal(tint(['M', 'R']).color, '#8250df');
  assert.equal(tint(['M']).color, '#2f65ca');
});

test('an all-untracked folder is grey, and an empty list means no tint', () => {
  assert.equal(directoryTint([{ path: 'd/a.ts', status: '??' }]).color, '#6e7781');
  assert.equal(directoryTint([]), null);
  assert.equal(directoryTint(null), null);
});

test('the tree row renders the tint on the name and no badge for folders', () => {
  /* The badge element must not be produced from `directoryStatus` for a directory. */
  assert.match(source, /directoryTint\(/);
  const start = source.indexOf('React.createElement(GitStatusBadge, {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 320);
  assert.doesNotMatch(block, /directoryStatus\(/);
});
