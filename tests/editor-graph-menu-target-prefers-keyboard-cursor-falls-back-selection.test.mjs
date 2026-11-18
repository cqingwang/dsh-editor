import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const logSource = readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');
const rowSource = readFileSync(join(root, 'src/client/components/commit/CommitGraphRow.tsx'), 'utf8');

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
  assert.match(logSource, /graphLogMenuTarget\(graphRows, graphCursor, selected\)/);
  assert.match(logSource, /commitLogGraphKeyIntent\(event\.key, event\.shiftKey === true\)/);
  assert.match(logSource, /data-dsh-graph-hash/);
  assert.match(logSource, /onContextMenu\?\.\(\{\s+commit: target,/);
});

test('graph rows expose their hash and popup semantics', () => {
  assert.match(rowSource, /data-dsh-graph-hash=\{entry\.hash\}/);
  assert.match(rowSource, /aria-haspopup='menu'/);
});
