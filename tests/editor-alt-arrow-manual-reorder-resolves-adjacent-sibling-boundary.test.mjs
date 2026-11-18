import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const menuSource = await readFile(
  new URL('../src/client/components/project/project-options-menu.ts', import.meta.url),
  'utf8',
);
const localesSource = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const source = [workspaceSource, terminalSource, menuSource, localesSource].join('\n');

function extractSource(name) {
  return transpileTypeScriptFunction(terminalSource, name);
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
  assert.match(treeKey, /\[\s*(?:applyTreeSelection,\s*)?children,\s*entries,\s*expanded,\s*manualOrder,[\s\S]*?reorderManualProject,[\s\S]*?sortMode,/);
});

test('Sort By can reset manual order without leaving Manual Order mode', () => {
  assert.match(source, /id: 'resetManualOrder'/);
  assert.match(source, /disabled: manualOrderEmpty/);
  assert.match(source, /setManualOrder\(\{\}\);\s*writeProjectManualOrder\(root, \{\}\);\s*flashStatus\(t\('editor\.manualOrderReset'\)\)/);
  assert.match(source, /resetManualOrderAction: '重置手动排序'/);
  assert.match(source, /resetManualOrderAction: 'Reset Manual Order'/);
});
