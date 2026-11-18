import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
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

const changeTypeaheadRows = new Function(
  `${extractFunction('basename')}; ${extractFunction('changeTypeaheadRows')}; return changeTypeaheadRows;`,
)();

test('change typeahead candidates use basenames and unique staged identities', () => {
  const rows = changeTypeaheadRows([
    { path: 'src/graph.ts', staged: false, order: 0 },
    { path: 'src/graph.ts', staged: true, order: 1 },
    { path: 'README.md', staged: false, order: 2 },
    { path: '', staged: false, order: 3 },
    null,
  ]);
  assert.deepEqual(rows.map((row) => row.name), ['graph.ts', 'graph.ts', 'README.md']);
  assert.deepEqual(rows.map((row) => row.path), ['unstaged:src/graph.ts', 'staged:src/graph.ts', 'unstaged:README.md']);
  assert.deepEqual(rows.map((row) => row.order), [0, 1, 2]);
});

test('Changes tree uses the shared typeahead instead of a second matcher', () => {
  const start = source.indexOf('const onChangesKeyDown = React.useCallback(');
  const end = source.indexOf('const onChangesKeyUp = React.useCallback(', start);
  const handler = source.slice(start, end);
  assert.match(source, /const changeTypeaheadBufferRef = React\.useRef\(''\)/);
  assert.match(source, /const changeTypeaheadAtRef = React\.useRef\(0\)/);
  assert.match(handler, /changeTypeaheadRows\(/);
  assert.match(handler, /typeaheadStep\(\{/);
  assert.match(handler, /data-dsh-change-path/);
  assert.match(handler, /data-dsh-change-staged/);
  assert.match(handler, /step\.hit !== null/);
  assert.match(handler, /scrollIntoView\?\.\(\{ block: 'nearest' \}\)/);
});

test('typeahead is inert for modifiers and the Space checkbox gesture', () => {
  const handler = source.slice(
    source.indexOf('const onChangesKeyDown = React.useCallback('),
    source.indexOf('const onChangesKeyUp = React.useCallback('),
  );
  assert.match(handler, /event\.key\.length === 1 && event\.key !== ' ' && !event\.metaKey && !event\.ctrlKey && !event\.altKey/);
  assert.match(handler, /if \(event\.key === ' '\) \{\n\s+event\.preventDefault\(\);/);
});
