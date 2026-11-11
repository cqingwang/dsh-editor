import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

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

const filterTreeRows = load('filterTreeRows');

test('a placeholder row disappears once the tree is filtered', () => {
  const rows = [
    { name: 'ws', path: '', kind: 'directory' },
    { name: 'emptydir', path: 'emptydir', kind: 'directory' },
    { name: '', path: 'emptydir::empty', kind: 'placeholder', empty: true },
    { name: 'other', path: 'other', kind: 'directory' },
  ];
  /* "(empty)" is a statement about the UNFILTERED directory; keeping it under a
     query makes the hit look like an empty folder. */
  const filtered = filterTreeRows(rows, 'empty');
  assert.deepEqual(filtered.map((row) => row.path), ['', 'emptydir']);
  assert.equal(filtered.some((row) => row.kind === 'placeholder'), false);
  /* The unfiltered tree still shows it. */
  assert.equal(filterTreeRows(rows, '').length, 4);
});

test('filtering keeps a hit directory and its ancestors', () => {
  const rows = [
    { name: 'ws', path: '', kind: 'directory' },
    { name: 'src', path: 'src', kind: 'directory' },
    { name: 'nested', path: 'src/nested', kind: 'directory' },
    { name: 'target.ts', path: 'src/nested/target.ts', kind: 'file' },
  ];
  assert.deepEqual(filterTreeRows(rows, 'target').map((row) => row.path), ['', 'src', 'src/nested', 'src/nested/target.ts']);
});
