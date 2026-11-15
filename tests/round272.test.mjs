import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extract(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

test('search result synthetic trees honor Compact Directories', () => {
  const factory = new Function(
    `'use strict';\n${extract('basename')}\n${extract('dirname')}\n${extract('continuationFlags')}\n${extract('compactDirectoryChain')}\n${extract('flattenRows')}\n${extract('searchEntryRows')}\nreturn searchEntryRows;`,
  );
  const matches = [{ path: 'docs/nested/deep/note.txt', name: 'note.txt', kind: 'file' }];
  const plain = factory()(matches, 'workspace', false);
  const compact = factory()(matches, 'workspace', true);
  assert.ok(plain.some((row) => row.path === 'docs'));
  assert.ok(plain.some((row) => row.path === 'docs/nested'));
  assert.ok(compact.some((row) => row.path === 'docs/nested/deep' && row.name === 'docs/nested/deep'));
  assert.ok(!compact.some((row) => row.path === 'docs'));
});

test('ProjectPanel passes the Compact Directories preference into search rows', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /searchEntryRows\(searchEntries, projectName, compactDirectories\)/);
});
