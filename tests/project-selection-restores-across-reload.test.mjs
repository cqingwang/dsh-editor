import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const model = await readFile(
  new URL('../src/client/components/project/project-selection-persistence.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function compileStorage() {
  const storage = new Map();
  const writes = [];
  const fakeWindow = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        writes.push([key, String(value)]);
        storage.set(key, String(value));
      },
      removeItem: (key) => storage.delete(key),
    },
  };
  const normalize = transpileTypeScriptFunction(model, 'normalizeProjectSelectionPath');
  const storageKey = transpileTypeScriptFunction(model, 'projectSelectionStorageKey');
  const read = transpileTypeScriptFunction(model, 'readProjectSelection');
  const write = transpileTypeScriptFunction(model, 'writeProjectSelection');
  const compiled = new Function(
    'window',
    `${normalize}\n${storageKey}\n${read}\n${write}\nreturn { readProjectSelection, writeProjectSelection };`,
  )(fakeWindow);
  return { storage, writes, ...compiled };
}

test('Project selection storage is scoped per workspace and clears missing selections', () => {
  const { readProjectSelection: read, writeProjectSelection: write, writes } = compileStorage();
  write('/workspace/a', 'src/a.ts');
  write('/workspace/a', 'src/a.ts');
  write('/workspace/b', 'src/b.ts');
  assert.deepEqual(writes, [
    ['dsh-editor.project.selection.v1:/workspace/a', 'src/a.ts'],
    ['dsh-editor.project.selection.v1:/workspace/b', 'src/b.ts'],
  ]);
  assert.equal(read('/workspace/a'), 'src/a.ts');
  assert.equal(read('/workspace/b'), 'src/b.ts');
  write('/workspace/a', null);
  assert.equal(read('/workspace/a'), null);
  assert.equal(read('/workspace/b'), 'src/b.ts');
});

test('restored Project selection must still be a visible non-placeholder row', () => {
  const normalize = transpileTypeScriptFunction(model, 'normalizeProjectSelectionPath');
  const visibleSource = transpileTypeScriptFunction(model, 'visibleProjectSelectionPath');
  const visible = new Function(`${normalize}\n${visibleSource}\nreturn visibleProjectSelectionPath;`)();
  const rows = [
    { path: 'src/a.ts', kind: 'file' },
    { path: 'src', kind: 'directory' },
    { path: 'empty', kind: 'placeholder' },
  ];
  assert.equal(visible('src/a.ts', rows), 'src/a.ts');
  assert.equal(visible('src', rows), 'src');
  assert.equal(visible('deleted.ts', rows), null);
  assert.equal(visible('empty', rows), null);
  assert.equal(visible('', rows), null);
});

test('the Project persistence hook restores once and then stores user selection changes', () => {
  const { storage, readProjectSelection, writeProjectSelection } = compileStorage();
  storage.set('dsh-editor.project.selection.v1:/workspace', 'README.md');
  const normalize = transpileTypeScriptFunction(model, 'normalizeProjectSelectionPath');
  const visibleSource = transpileTypeScriptFunction(model, 'visibleProjectSelectionPath');
  const visible = new Function(`${normalize}\n${visibleSource}\nreturn visibleProjectSelectionPath;`)();
  const hookCode = transpileTypeScriptFunction(model, 'useProjectSelectionPersistence');
  const hookState = [];
  let effect = null;
  const fakeReact = {
    useRef: (value) => {
      hookState[0] ??= { current: value };
      return hookState[0];
    },
    useEffect: (callback) => {
      effect = callback;
    },
  };
  const hook = new Function(
    'React',
    'readProjectSelection',
    'writeProjectSelection',
    'visibleProjectSelectionPath',
    `${hookCode}\nreturn useProjectSelectionPersistence;`,
  )(fakeReact, readProjectSelection, writeProjectSelection, visible);
  const rows = [{ path: 'README.md', kind: 'file' }];
  const selected = [];
  hook({
    root: '/workspace',
    ready: true,
    rows,
    selectedPath: null,
    onSelect: (path) => selected.push(path),
  });
  effect();
  assert.deepEqual(selected, ['README.md']);
  assert.equal(storage.get('dsh-editor.project.selection.v1:/workspace'), 'README.md');

  hook({
    root: '/workspace',
    ready: true,
    rows,
    selectedPath: 'README.md',
    onSelect: (path) => selected.push(path),
  });
  effect();
  assert.deepEqual(selected, ['README.md']);
  assert.equal(storage.get('dsh-editor.project.selection.v1:/workspace'), 'README.md');

  const otherRows = [{ path: 'other.ts', kind: 'file' }];
  hook({
    root: '/other',
    ready: true,
    rows: otherRows,
    selectedPath: 'README.md',
    onSelect: (path) => selected.push(path),
  });
  effect();
  assert.deepEqual(selected, ['README.md', null]);
  assert.equal(storage.has('dsh-editor.project.selection.v1:/other'), false);
});

test('EditorWorkspace wires Project selection persistence after rows are ready', () => {
  assert.match(workspace, /import \{ useProjectSelectionPersistence \}/u);
  assert.match(
    workspace,
    /useProjectSelectionPersistence\(\{\s+root,\s+ready: expansionReady,\s+rows,\s+selectedPath,\s+onSelect: setSelectedPath,?\s+\}\);/u,
  );
});
