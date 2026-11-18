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

test('a freshly renamed or moved path survives until the refreshed rows arrive', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/renamed.js',
      previousPaths: ['src', 'src/app.js'],
      rowPaths: ['src', 'src/app.js'],
      expanded: new Set(['', 'src']),
    }),
    'src/renamed.js',
  );
});

test('an old path that existed before the refresh still falls back after removal', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/app.js',
      previousPaths: ['src', 'src/app.js', 'src/nav.js'],
      rowPaths: ['src', 'src/nav.js'],
      expanded: new Set(['', 'src']),
    }),
    'src/nav.js',
  );
});
