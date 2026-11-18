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

const projectSelectionAfterRowsChange = new Function(
  `${extract('dirname')}\n${extract('projectSelectionAfterRowsChange')}\nreturn projectSelectionAfterRowsChange;`,
)();

test('an externally deleted selected row converges to the nearest survivor', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'round780-external.txt',
      previousPaths: ['README.md', 'round780-external.txt'],
      rowPaths: ['README.md'],
      expanded: new Set(['']),
    }),
    'README.md',
  );
});

test('a child hidden by a collapsed ancestor keeps its selection', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/app.js',
      previousPaths: ['src', 'src/app.js'],
      rowPaths: ['src'],
      expanded: new Set(['']),
    }),
    'src/app.js',
  );
});

test('an existing selected row is never moved', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/app.js',
      previousPaths: ['src', 'src/app.js'],
      rowPaths: ['src', 'src/app.js'],
      expanded: new Set(['', 'src']),
    }),
    'src/app.js',
  );
});
