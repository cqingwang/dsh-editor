import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (  readFileSync(join(root, 'lib/client.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'tests/fixtures/commit-graph.legacy.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

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

const graphLogMenuTarget = new Function(
  `${extractFunction('graphLogMenuTarget')}; return graphLogMenuTarget;`,
)();

const entries = [{ hash: 'a' }, { hash: 'b' }];

test('graph menu target prefers keyboard cursor and falls back to selection', () => {
  assert.equal(graphLogMenuTarget(entries, 'b', 'a')?.hash, 'b');
  assert.equal(graphLogMenuTarget(entries, null, 'a')?.hash, 'a');
  assert.equal(graphLogMenuTarget(entries, 'missing', 'b')?.hash, 'b');
  assert.equal(graphLogMenuTarget(entries, null, null), null);
  assert.equal(graphLogMenuTarget([], 'a', 'b'), null);
});

test('graph Log opens the shared menu from the keyboard cursor', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /graphLogMenuTarget\(graphRows, graphCursor, selected\)/);
  assert.match(log, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(log, /data-dsh-graph-hash/);
  assert.match(log, /onContextMenu\?\.\(\{\s+commit: target,/);
});

test('graph rows expose their hash and popup semantics', () => {
  const graph = source.slice(
    source.indexOf('function CommitGraph('),
    source.indexOf('/* COMMIT_GRAPH_BOUNDARY */'),
  );
  assert.match(graph, /'data-dsh-graph-hash': entry\.hash/);
  assert.match(graph, /'aria-haspopup': 'menu'/);
});
