import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const projectPanelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const fileTreeViewSource = await readFile(
  new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url),
  'utf8',
);
const selectionModel = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);

function selectionTransition() {
  return loadTypeScriptFunction(selectionModel, 'projectTreeSelectionAfterPointer');
}

const rows = [
  { path: '', kind: 'directory' },
  { path: 'src', kind: 'directory' },
  { path: 'src/a.js', kind: 'file' },
  { path: 'src/b.js', kind: 'file' },
  { path: 'README.md', kind: 'file' },
];

test('plain Project-tree click replaces every prior selection', () => {
  const transition = selectionTransition();
  const next = transition({
    rows,
    selection: new Set(['src/a.js', 'src/b.js']),
    primary: 'src/b.js',
    anchor: 'src/a.js',
    path: 'README.md',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
  });
  assert.deepEqual([...next.selection], ['README.md']);
  assert.equal(next.primary, 'README.md');
  assert.equal(next.anchor, 'README.md');
});

test('Project and Change trees expose multi-selection semantics', () => {
  assert.match(fileTreeViewSource, /aria-multiselectable=\{true\}/u);
  assert.match(fileTreeViewSource, /aria-activedescendant=\{activeDescendantId\}/u);
  assert.match(fileTreeViewSource, /id=\{rowDomId\(rowIndex\)\}/u);
  assert.match(
    readFileSync(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8'),
    /aria-multiselectable=\{true\}/u,
  );
});

test('Command click adds a file to the existing selection', () => {
  const transition = selectionTransition();
  const next = transition({
    rows,
    selection: new Set(['src/a.js']),
    primary: 'src/a.js',
    anchor: 'src/a.js',
    path: 'src/b.js',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
  });
  assert.deepEqual([...next.selection], ['src/a.js', 'src/b.js']);
  assert.equal(next.primary, 'src/b.js');
  assert.equal(next.anchor, 'src/b.js');
});

test('Command click removes an already selected file without clearing the others', () => {
  const transition = selectionTransition();
  const next = transition({
    rows,
    selection: new Set(['src/a.js', 'src/b.js', 'README.md']),
    primary: 'src/b.js',
    anchor: 'src/b.js',
    path: 'src/b.js',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
  });
  assert.deepEqual([...next.selection], ['src/a.js', 'README.md']);
  assert.notEqual(next.primary, 'src/b.js');
  assert.notEqual(next.anchor, 'src/b.js');
});

test('Ctrl acts as the non-macOS multi-select modifier', () => {
  const transition = selectionTransition();
  const next = transition({
    rows,
    selection: new Set(['src/a.js']),
    primary: 'src/a.js',
    anchor: 'src/a.js',
    path: 'src/b.js',
    metaKey: false,
    ctrlKey: true,
    shiftKey: false,
  });
  assert.deepEqual([...next.selection], ['src/a.js', 'src/b.js']);
});

test('Shift range stays anchored while Command toggles the clicked row', () => {
  const transition = selectionTransition();
  const range = transition({
    rows,
    selection: new Set(['src']),
    primary: 'src',
    anchor: 'src',
    path: 'src/b.js',
    metaKey: false,
    ctrlKey: false,
    shiftKey: true,
  });
  assert.deepEqual([...range.selection], ['src', 'src/a.js', 'src/b.js']);
  assert.equal(range.primary, 'src/b.js');
  assert.equal(range.anchor, 'src');
});

test('Project rows commit selection on mousedown and do not toggle again on click', () => {
  const rowBlock = projectPanelSource.slice(
    projectPanelSource.indexOf('onRowPointerDown={(state, event) => {'),
    projectPanelSource.indexOf('onRowClick={(state, event) => {'),
  );
  assert.match(rowBlock, /onRowPointerDown=\{\(state, event\) => \{[\s\S]*?selectVisibleRow\(row, event\);/u);
  assert.match(rowBlock, /treeRef\.current\?\.focus\(\);/u);
  assert.doesNotMatch(rowBlock, /onClick=\{\(event\) => \{\s*onSelect\(row, event\);/u);
});

test('Project selection no longer updates another state inside a state updater', () => {
  assert.doesNotMatch(source, /setSelection\(\(current\) => \{[\s\S]{0,600}?setSelectedPathRaw\(/u);
  assert.match(selectionModel, /function projectTreeSelectionAfterPointer\(/u);
});
