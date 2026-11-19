import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const terminal = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');

test('Project tree accessibility positions are computed in one traversal', () => {
  const projectTreePositions = loadTypeScriptFunction(terminal, 'projectTreePositions');
  const rows = [
    { path: 'a', kind: 'directory', depth: 0 },
    { path: 'a/one.txt', kind: 'file', depth: 1 },
    { path: 'a/two.txt', kind: 'file', depth: 1 },
    { path: 'b', kind: 'directory', depth: 0 },
    { path: 'b/only.txt', kind: 'file', depth: 1 },
    { path: '::empty', kind: 'placeholder', depth: 2 },
  ];
  assert.deepEqual(projectTreePositions(rows), [
    { level: 1, posinset: 1, setsize: 2 },
    { level: 2, posinset: 1, setsize: 2 },
    { level: 2, posinset: 2, setsize: 2 },
    { level: 1, posinset: 2, setsize: 2 },
    { level: 2, posinset: 1, setsize: 1 },
    { level: 3, posinset: 1, setsize: 1 },
  ]);
});

test('ProjectPanel precomputes positions instead of rescanning the tree per row', () => {
  assert.match(panel, /projectTreePositions/u);
  assert.match(
    panel,
    /const projectRowPositions = React\.useMemo\(\(\) => projectTreePositions\(visibleRows\), \[visibleRows\]\)/u,
  );
  assert.match(panel, /projectRowPosition: projectRowPositions\[rowIndex\]/u);
  assert.match(panel, /const \{[\s\S]*?projectRowPosition,[\s\S]*?\} =\s*projectRowPresentation/u);
  assert.doesNotMatch(panel, /projectTreePosition\(visibleRows, rowIndex\)/u);
});
