import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const filteredViewSelection = loadTypeScriptFunction(terminalSource, 'filteredViewSelection');

test('filtered views drop hidden selections without following the active file', () => {
  const rows = ['README.md', 'src/a.ts'];
  const current = new Set(['README.md', 'src/a.ts', 'hidden.txt']);
  const state = filteredViewSelection(rows, current, 'hidden.txt', 'src/a.ts');
  assert.deepEqual([...state.selection], ['README.md', 'src/a.ts']);
  assert.equal(state.primary, 'README.md');
});

test('filtered views retain the same selection object when it is already valid', () => {
  const rows = ['README.md', 'src/a.ts'];
  const current = new Set(['README.md', 'src/a.ts']);
  const state = filteredViewSelection(rows, current, 'README.md', null);
  assert.equal(state.selection, current);
  assert.equal(state.primary, 'README.md');
});

test('filtered views select the first visible row when active selection is hidden', () => {
  const state = filteredViewSelection(['README.md', 'src/a.ts'], new Set(['gone.txt']), 'gone.txt', 'missing.txt');
  assert.deepEqual([...state.selection], ['README.md']);
  assert.equal(state.primary, 'README.md');
});

test('view changes sanitize selection using the helper', () => {
  const start = source.indexOf('const nextState = filteredViewSelection(');
  assert.notEqual(start, -1, 'filtered-view selection effect should exist');
  const block = source.slice(start, start + 900);
  assert.match(block, /applyTreeSelection\(nextState\.selection, nextState\.primary, nextState\.primary\)/);
  assert.doesNotMatch(block, /setSelection\(/);
});

test('leaving a filtered view returns to the last real project tree view', () => {
  assert.match(source, /const lastProjectTreeViewRef = React\.useRef\(/);
  assert.match(source, /if \(projectViewIsTree\(normalized\)\) lastProjectTreeViewRef\.current = normalized;/);
  assert.match(source, /applyProjectView\(\s+lastProjectTreeViewRef\.current,\s+\)/);
  assert.doesNotMatch(source, /applyProjectView\('project'\);\s*setActivity\('project'\)/);
});
