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

const searchEntryRows = new Function(
  `${extract('basename')}\n${extract('dirname')}\n${extract('continuationFlags')}\n${extract('compactDirectoryChain')}\n${extract('orderProjectEntriesByManual')}\n${extract('flattenRows')}\n${extract('searchEntryRows')}\nreturn searchEntryRows;`,
)();

test('speed-search results retain manual sibling order and ancestors', () => {
  const rows = searchEntryRows(
    [
      { path: 'src/z-last.ts', name: 'z-last.ts', kind: 'file' },
      { path: 'src/a-first.ts', name: 'a-first.ts', kind: 'file' },
      { path: 'docs/note.md', name: 'note.md', kind: 'file' },
    ],
    'workspace',
    false,
    'manual',
    {
      '': ['docs', 'src'],
      src: ['src/a-first.ts', 'src/z-last.ts'],
      docs: ['docs/note.md'],
    },
  );
  assert.deepEqual(rows.map((row) => row.path), [
    'docs',
    'docs/note.md',
    'src',
    'src/a-first.ts',
    'src/z-last.ts',
  ]);
});

test('non-manual speed search preserves host ordering', () => {
  const rows = searchEntryRows(
    [
      { path: 'z.txt', name: 'z.txt', kind: 'file' },
      { path: 'a.txt', name: 'a.txt', kind: 'file' },
    ],
    'workspace',
    false,
    'name',
    {},
  );
  assert.deepEqual(rows.map((row) => row.path), ['z.txt', 'a.txt']);
});

test('ProjectPanel receives manual order and forwards it to search row synthesis', () => {
  assert.match(source, /searchEntryRows\(searchEntries, projectName, compactDirectories, sortMode, manualOrder\)/u);
  assert.match(source, /manualOrder,\s+onManualReorder,/u);
  assert.match(source, /React\.createElement\(ProjectPanel, \{[\s\S]*?manualOrder,/u);
});
