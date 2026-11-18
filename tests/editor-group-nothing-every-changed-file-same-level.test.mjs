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
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

const helpers = new Function(
  [
    'basename',
    'dirname',
    'sortChangeTree',
    'changeTreeOf',
    'collectChanges',
    'flattenChangeTree',
    'groupingDepth',
  ].map(extract).join('\n')
  + '\nreturn { changeTreeOf, flattenChangeTree, groupingDepth };',
)();

const changes = [
  { path: 'root.txt', status: '??' },
  { path: 'docs/top.txt', status: '??' },
  { path: 'docs/nested/deep.txt', status: '??' },
];

function rowsFor(mode) {
  const tree = helpers.changeTreeOf(changes, helpers.groupingDepth(mode));
  return helpers.flattenChangeTree(tree, new Set(), 'unversioned');
}

test('Group by Nothing keeps every changed file at the same level', () => {
  assert.deepEqual(
    rowsFor('flat').map((row) => [row.kind, row.path, row.depth]),
    [
      ['file', 'docs/nested/deep.txt', 0],
      ['file', 'docs/top.txt', 0],
      ['file', 'root.txt', 0],
    ],
  );
});

test('Group by Module keeps only the first path segment as a directory', () => {
  assert.deepEqual(
    rowsFor('module').map((row) => [row.kind, row.path, row.depth]),
    [
      ['directory', 'docs', 0],
      ['file', 'docs/nested/deep.txt', 1],
      ['file', 'docs/top.txt', 1],
      ['file', 'root.txt', 0],
    ],
  );
});

test('Group by Directory preserves every expanded directory level', () => {
  assert.deepEqual(
    rowsFor('directory').map((row) => [row.kind, row.path, row.depth]),
    [
      ['directory', 'docs', 0],
      ['directory', 'docs/nested', 1],
      ['file', 'docs/nested/deep.txt', 2],
      ['file', 'docs/top.txt', 1],
      ['file', 'root.txt', 0],
    ],
  );
});
