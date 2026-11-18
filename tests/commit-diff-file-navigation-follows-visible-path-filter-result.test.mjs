import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const diffModelSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');
const filterChangeSequence = loadTypeScriptFunction(diffModelSource, 'filterChangeSequence');

test('diff file navigation follows the visible path-filter result', () => {
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
  const start = source.indexOf('const diffChangeSequence =');
  const end = source.indexOf('const navigateDiffFile = React.useCallback(', start);
  const block = source.slice(start, end);
  assert.match(block, /filterChangeSequence\(changeSequenceOf\(git\?\.changes \?\? \[\], groupBy\), pathQuery\)/);
  assert.match(block, /\[git, groupBy, pathQuery\]/);
});
