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
  assert.fail(`unterminated ${name}`);
}

function loadFlattenRows() {
  return new Function(
    `${extract('continuationFlags')}\n`
    + `${extract('orderProjectEntriesByManual')}\n`
    + `${extract('compactDirectoryChain')}\n`
    + `${extract('flattenRows')}\n`
    + 'return flattenRows;',
  )();
}

const flattenRows = loadFlattenRows();

test('A directory that contains itself is rendered once instead of overflowing the stack', () => {
  const loop = { name: 'loop', path: 'loop', kind: 'directory' };
  const rows = flattenRows(
    [loop],
    { loop: [loop] },
    new Set(['loop']),
    'fixture',
    '/private/tmp/fixture',
  );
  assert.deepEqual(rows.map((row) => row.path), ['loop']);
  assert.equal(rows[0].depth, 0);
});

test('An indirect child-to-ancestor cycle stops before re-entering the ancestor', () => {
  const ancestor = { name: 'a', path: 'a', kind: 'directory' };
  const child = { name: 'b', path: 'a/b', kind: 'directory' };
  const rows = flattenRows(
    [ancestor],
    { a: [child], 'a/b': [ancestor] },
    new Set(['a', 'a/b']),
    'fixture',
    '/private/tmp/fixture',
  );
  assert.deepEqual(rows.map((row) => row.path), ['a', 'a/b']);
});

test('An adversarially deep expanded chain stays bounded', () => {
  const entries = [{ name: 'd0', path: 'd0', kind: 'directory' }];
  const children = {};
  const expanded = new Set();
  for (let index = 0; index < 300; index += 1) {
    const path = `d${index}`;
    const child = { name: `d${index + 1}`, path: `d${index + 1}`, kind: 'directory' };
    children[path] = [child];
    expanded.add(path);
  }
  const rows = flattenRows(
    entries,
    children,
    expanded,
    'fixture',
    '/private/tmp/fixture',
  );
  assert.ok(rows.length <= 129, `deep tree produced ${rows.length} rows`);
  assert.equal(rows[0].path, 'd0');
});

test('The iterative walk keeps sibling and compact-directory output stable', () => {
  const rows = flattenRows(
    [
      { name: 'chain', path: 'chain', kind: 'directory' },
      { name: 'README.md', path: 'README.md', kind: 'file' },
    ],
    {
      chain: [{ name: 'deep', path: 'chain/deep', kind: 'directory' }],
      'chain/deep': [{ name: 'file.js', path: 'chain/deep/file.js', kind: 'file' }],
    },
    new Set(['chain', 'chain/deep']),
    'fixture',
    '/private/tmp/fixture',
    true,
  );
  assert.deepEqual(rows.map((row) => row.path), ['chain/deep', 'chain/deep/file.js', 'README.md']);
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 0]);
});
