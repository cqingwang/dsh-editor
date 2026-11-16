import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
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

const boundary = new Function(`${extractSource('manualReorderBoundary')}\nreturn manualReorderBoundary;`)();

test('Alt+Arrow manual reorder resolves the adjacent sibling boundary', () => {
  assert.deepEqual(boundary(['a', 'b', 'c', 'd'], ['c'], 'up'), { target: 'b', edge: 'before' });
  assert.deepEqual(boundary(['a', 'b', 'c', 'd'], ['b'], 'down'), { target: 'c', edge: 'after' });
  assert.deepEqual(boundary(['a', 'b', 'c', 'd'], ['b', 'c'], 'up'), { target: 'a', edge: 'before' });
  assert.deepEqual(boundary(['a', 'b', 'c', 'd'], ['b', 'c'], 'down'), { target: 'd', edge: 'after' });
  assert.equal(boundary(['a', 'b'], ['a'], 'up'), null);
  assert.equal(boundary(['a', 'b'], ['b'], 'down'), null);
});

test('Project tree owns Alt+Up/Down only in Manual Order', () => {
  const start = source.indexOf('const onTreeKeyDown = React.useCallback(');
  const end = source.indexOf('const toggleCommitPath = React.useCallback(', start);
  const treeKey = source.slice(start, end);
  assert.match(treeKey, /sortMode === 'manual'/);
  assert.match(treeKey, /event\.altKey/);
  assert.match(treeKey, /event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'/);
  assert.match(treeKey, /manualReorderBoundary\(/);
  assert.match(treeKey, /reorderManualProject\(sources, boundary\.target, boundary\.edge\)/);
  assert.match(treeKey, /scrollIntoView\?\.\(\{ block: 'nearest' \}\)/);
  assert.match(treeKey, /\[children, entries, expanded, manualOrder,[\s\S]*?reorderManualProject,[\s\S]*?sortMode,/);
});

test('Sort By can reset manual order without leaving Manual Order mode', () => {
  assert.match(source, /id: 'resetManualOrder'/);
  assert.match(source, /disabled: Object\.keys\(manualOrder\)\.length === 0/);
  assert.match(source, /setManualOrder\(\{\}\);\s*writeProjectManualOrder\(root, \{\}\);\s*flashStatus\(t\('editor\.manualOrderReset'\)\)/);
  assert.match(source, /resetManualOrderAction: '重置手动排序'/);
  assert.match(source, /resetManualOrderAction: 'Reset Manual Order'/);
});
