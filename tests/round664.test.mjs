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

const flattenRows = new Function(
  `${extract('continuationFlags')}\n${extract('orderProjectEntriesByManual')}\n${extract('flattenRows')}\n`
  + 'return flattenRows;',
)();

test('Project rows start at the real top-level entries without a synthetic root row', () => {
  const rows = flattenRows(
    [
      { name: 'docs', path: 'docs', kind: 'directory' },
      { name: 'README.md', path: 'README.md', kind: 'file' },
    ],
    { docs: [{ name: 'notes.md', path: 'docs/notes.md', kind: 'file' }] },
    new Set(['docs']),
    'fixture',
    '/private/tmp/fixture',
  );
  assert.deepEqual(rows.map((row) => row.path), ['docs', 'docs/notes.md', 'README.md']);
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 0]);
  assert.ok(rows.every((row) => row.root !== true));
});

test('An empty Project tree starts with the placeholder at depth zero', () => {
  const rows = flattenRows([], {}, new Set(), 'fixture', '/private/tmp/fixture');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'placeholder');
  assert.equal(rows[0].depth, 0);
});

test('The project tree no longer creates a named root row', () => {
  assert.doesNotMatch(source, /name: projectName, path: '', kind: 'directory', root: true, depth: 0/);
});
