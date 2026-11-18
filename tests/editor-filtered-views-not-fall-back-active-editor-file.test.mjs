import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const filteredViewSelection = loadTypeScriptFunction(terminalSource, 'filteredViewSelection');

test('filtered views do not fall back to the active editor file', () => {
  const state = filteredViewSelection(
    ['README.md', 'src/app.js'],
    new Set(['hidden.txt']),
    'hidden.txt',
    'src/app.js',
  );
  assert.deepEqual([...state.selection], ['README.md']);
  assert.equal(state.primary, 'README.md');
});

test('filtered view convergence ignores activePath changes', () => {
  const start = source.indexOf('const nextState = filteredViewSelection(');
  assert.notEqual(start, -1, 'filtered view effect should exist');
  const block = source.slice(start, start + 700);
  assert.match(block, /filteredViewSelection\(\s*rows\.map\(\(row\) => row\.path\),\s*selection,\s*selectedPath,\s*\)/u);
  assert.doesNotMatch(block, /activePath/u);
});
