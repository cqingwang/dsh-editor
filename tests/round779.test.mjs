import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
}

const filteredViewSelection = new Function(
  `${extract('filteredViewSelection')}\nreturn filteredViewSelection;`,
)();

test('filtered views do not fall back to the active editor file', () => {
  const state = filteredViewSelection(
    ['README.md', 'src/app.js'],
    new Set(['hidden.txt']),
    'hidden.txt',
    'src/app.js',
  );
  assert.deepEqual([...state.selection], ['README.md']);
  assert.equal(state.primary, 'README.md');
});

test('filtered view convergence ignores activePath changes', () => {
  const start = source.indexOf('const nextState = filteredViewSelection(');
  assert.notEqual(start, -1, 'filtered view effect should exist');
  const block = source.slice(start, start + 700);
  assert.match(block, /filteredViewSelection\(\s*rows\.map\(\(row\) => row\.path\),\s*selection,\s*selectedPath,\s*\)/u);
  assert.doesNotMatch(block, /activePath/u);
});
