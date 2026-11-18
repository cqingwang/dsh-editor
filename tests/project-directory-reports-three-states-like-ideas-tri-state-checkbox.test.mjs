import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const commitModelSource = readFileSync(join(root, 'src/client/components/ui/commit-model.ts'), 'utf8');

/** Evaluate one shipping function by brace balance. */
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

const selectionStateOf = loadTypeScriptFunction(commitModelSource, 'selectionStateOf');

test('a directory reports three states, like IDEA\'s tri-state checkbox', () => {
  const paths = ['src/a.ts', 'src/b.ts'];
  assert.equal(selectionStateOf(paths, new Set(paths)), 'all');
  assert.equal(selectionStateOf(paths, new Set(['src/a.ts'])), 'some');
  assert.equal(selectionStateOf(paths, new Set()), 'none');
  /* An empty directory is not "indeterminate"; it has nothing to select. */
  assert.equal(selectionStateOf([], new Set(['x'])), 'none');
  /* A selection outside this directory does not make it partially selected. */
  assert.equal(selectionStateOf(paths, new Set(['other/c.ts'])), 'none');
});

test('the indeterminate flag is set through the DOM property, not React props', () => {
  const start = source.indexOf("if (row.kind === 'directory') {");
  assert.notEqual(start, -1);
  /* Slice to the file-row branch rather than a fixed width: keyboard/ARIA
     support can grow the directory row without silently truncating this
     contract. */
  const block = source.slice(start, source.indexOf('const change = row.change;', start));
  /* `indeterminate` only exists as a property; passing it as a prop is ignored. */
  assert.match(block, /element\.indeterminate = state === 'some'/);
  assert.match(block, /ref=\{\(element\) => \{[\s\S]*?\.indeterminate = state === 'some'/);
  /* The directory row must reflect the state, not just "all or nothing". */
  assert.match(block, /const state = selectionStateOf\(inside, selectedPaths\);/);
  assert.match(block, /checked=\{state === 'all'\}/);
});

test('the group header shows the same three states', () => {
  const start = source.indexOf('const renderGroup = (group');
  assert.notEqual(start, -1);
  /* Round 141 added the group-level fold (its own `groupKey`/`groupOpen` pair)
     ahead of the header, so the header's checkbox moved past 1400 chars; round
     146's `groupingDepth(groupBy)` pushed it past 2000. Slice to the next
     renderer instead of a fixed width, so unrelated growth cannot move it out
     of the window again. */
  const end = source.indexOf('rows.length === 0', start);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /const groupState = selectionStateOf\(\s+group\.changes\.map\(\(change\) => change\.path\),\s+selectedPaths,\s+\);/u);
  assert.match(block, /checked=\{groupState === 'all'\}/);
});
