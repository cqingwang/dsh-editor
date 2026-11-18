import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/project/project-selection-model.ts');

test('project selection model is typed and self-contained', () => {
  const transition = loadTypeScriptFunction(model, 'projectTreeSelectionAfterPointer');
  const rows = [
    { path: '', kind: 'directory' },
    { path: 'src', kind: 'directory' },
    { path: 'src/a.js', kind: 'file' },
    { path: 'src/b.js', kind: 'file' },
    { path: 'README.md', kind: 'file' },
  ];
  const next = transition({
    rows,
    selection: new Set(['src', 'src/a.js']),
    primary: 'src/a.js',
    anchor: 'src',
    path: 'src/b.js',
    shiftKey: true,
  });
  assert.deepEqual([...next.selection], ['src', 'src/a.js', 'src/b.js']);
  assert.equal(next.primary, 'src/b.js');
  assert.equal(next.anchor, 'src');
});

test('project selection model filters unknown rows and preserves valid fallback', () => {
  const transition = loadTypeScriptFunction(model, 'projectTreeSelectionAfterPointer');
  const rows = [
    { path: 'a.ts', kind: 'file' },
    { path: 'b.ts', kind: 'file' },
    { path: 'placeholder', kind: 'placeholder' },
  ];
  const next = transition({
    rows,
    selection: new Set(['a.ts', 'deleted.ts', 'placeholder']),
    primary: 'a.ts',
    anchor: 'deleted.ts',
    path: 'missing.ts',
  });
  assert.deepEqual([...next.selection], ['a.ts']);
  assert.equal(next.primary, 'a.ts');
  assert.equal(next.anchor, 'deleted.ts');
});
