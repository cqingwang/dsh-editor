import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('diff file navigation follows the visible path-filter result', () => {
  const filterChangeSequence = extractFunction('filterChangeSequence');
  const sequence = [
    { path: 'README.md', staged: false },
    { path: 'src/Alpha.ts', staged: true },
    { path: 'untracked.txt', staged: false },
  ];
  assert.deepEqual(filterChangeSequence(sequence, ''), sequence);
  assert.deepEqual(filterChangeSequence(sequence, ' alpha '), [{ path: 'src/Alpha.ts', staged: true }]);
  assert.deepEqual(filterChangeSequence(sequence, 'untracked'), [{ path: 'untracked.txt', staged: false }]);
  assert.deepEqual(filterChangeSequence(sequence, 'missing'), []);
});

test('the diff position and file sequence are both derived from the filtered changes', () => {
  const start = source.indexOf('const diffChangeSequence = React.useMemo(');
  const end = source.indexOf('const navigateDiffFile = React.useCallback(', start);
  const block = source.slice(start, end);
  assert.match(block, /filterChangeSequence\(changeSequenceOf\(git\?\.changes \?\? \[\], groupBy\), pathQuery\)/);
  assert.match(block, /\[git, groupBy, pathQuery\]/);
});
