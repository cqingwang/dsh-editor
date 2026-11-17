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

const projectSelectionSetAfterRowsChange = new Function(
  `${extract('dirname')}\n${extract('projectSelectionAfterRowsChange')}\n`
    + `${extract('projectSelectionSetAfterRowsChange')}\nreturn projectSelectionSetAfterRowsChange;`,
)();

test('multi-selection drops deleted rows and falls back inside the existing selection', () => {
  const state = projectSelectionSetAfterRowsChange({
    selection: new Set(['README.md', 'deleted.txt', 'src/nav.js']),
    selectedPath: 'deleted.txt',
    previousPaths: ['README.md', 'deleted.txt', 'src/nav.js'],
    rowPaths: ['README.md', 'src/nav.js'],
    expanded: new Set(['', 'src']),
  });
  assert.deepEqual([...state.selection], ['README.md', 'src/nav.js']);
  assert.equal(state.primary, 'src/nav.js');
});

test('internal delete relies on reconciliation instead of clearing selection', () => {
  const singleStart = source.indexOf('const removeEntry = React.useCallback(');
  const single = source.slice(singleStart, source.indexOf('const checkExternalChanges', singleStart));
  assert.doesNotMatch(single, /setSelectedPath\(null\)/u);

  const batchStart = source.indexOf('const removeEntries = React.useCallback(');
  const batch = source.slice(batchStart, singleStart);
  assert.doesNotMatch(batch, /applyTreeSelection\(new Set\(\), null, null\)/u);
});
