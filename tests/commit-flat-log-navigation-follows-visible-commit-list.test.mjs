import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

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

const flatLogTarget = new Function(
  `${extractFunction('flatLogTarget')}; return flatLogTarget;`,
)();

const commits = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }];

test('flat Log navigation follows the visible commit list', () => {
  assert.equal(flatLogTarget(commits, null, 'next'), 'a');
  assert.equal(flatLogTarget(commits, null, 'previous'), 'c');
  assert.equal(flatLogTarget(commits, 'b', 'next'), 'c');
  assert.equal(flatLogTarget(commits, 'b', 'previous'), 'a');
  assert.equal(flatLogTarget(commits, 'b', 'first'), 'a');
  assert.equal(flatLogTarget(commits, 'b', 'last'), 'c');
});

test('flat Log navigation clamps ends and ignores empty lists', () => {
  assert.equal(flatLogTarget(commits, 'c', 'next'), 'c');
  assert.equal(flatLogTarget(commits, 'a', 'previous'), 'a');
  assert.equal(flatLogTarget([], 'a', 'next'), null);
  assert.equal(flatLogTarget(null, null, 'last'), null);
});

test('default Log list is focusable and owns arrow/Home/End keys', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /tabIndex: 0,/);
  assert.match(log, /role: 'listbox'/);
  assert.match(log, /flatLogTarget\(visible, selected,/);
  assert.match(log, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(log, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(log, /onShow\?\.\(target\)/);
});

test('clicking a flat log row returns keyboard ownership to the list', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /onMouseDown: \(\) => listRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(log, /role: 'option'/);
});
