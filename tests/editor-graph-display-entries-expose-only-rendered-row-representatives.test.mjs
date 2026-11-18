import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const logSource = readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');
const graphSource = readFileSync(join(root, 'src/client/components/commit/CommitGraph.tsx'), 'utf8');

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

const graphDisplayEntries = new Function(
  `${extractFunction('linearRun')}; ${extractFunction('assignGraphLanes')}; ${extractFunction('graphDisplayEntries')}; return graphDisplayEntries;`,
)();

const entries = [
  { hash: 'c3', parents: ['c2'] },
  { hash: 'c2', parents: ['c1'] },
  { hash: 'c1', parents: [] },
];

test('graph display entries expose only rendered row representatives', () => {
  assert.deepEqual(graphDisplayEntries(entries, false).map((entry) => entry.hash), ['c3', 'c2', 'c1']);
  assert.deepEqual(graphDisplayEntries(entries, true).map((entry) => entry.hash), ['c3']);
});

test('CommitLog keyboard navigation uses folded graph rows', () => {
  assert.match(logSource, /const \[graphFolded, setGraphFolded\] = React\.useState\(false\)/);
  assert.match(logSource, /const graphRows = graphDisplayEntries\(graphEntries, graphFolded\)/);
  assert.match(logSource, /commitLogGraphCursor\(graphRows, graphCursor\)/);
  assert.match(logSource, /setGraphCursor\(next\.hash\)/);
  assert.match(logSource, /graphLogMenuTarget\(graphRows, graphCursor, selected\)/);
  assert.match(logSource, /onShow\?\.\(command\.hash\)/);
});

test('fold state is owned by CommitLog rather than CommitGraph', () => {
  assert.doesNotMatch(graphSource, /React\.useState\(false\)/);
  assert.match(graphSource, /const rowsToDraw = folded\s+\?\s+runs\s+:\s+entries\.map/);
  assert.match(graphSource, /onToggleFolded=\{onToggleFolded\}/);
});
