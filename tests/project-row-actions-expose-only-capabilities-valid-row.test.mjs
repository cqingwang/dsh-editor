import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const model = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function menuBlock() {
  const start = workspace.indexOf('const buildTreeMenu = React.useCallback(');
  const end = workspace.indexOf('/* Move one entry into a directory by drag-and-drop', start);
  assert.ok(start >= 0 && end > start, 'buildTreeMenu should exist');
  return workspace.slice(start, end);
}

test('Project row actions expose only capabilities valid for that row', () => {
  const capabilities = loadTypeScriptFunction(model, 'projectRowMenuCapabilities');
  assert.deepEqual(capabilities({ path: 'README.md', kind: 'file' }, false), {
    isDirectory: false,
    isRoot: false,
    showDirectoryActions: false,
    showFileActions: true,
    showReveal: false,
  });
  assert.deepEqual(capabilities({ path: 'README.md', kind: 'file' }, true), {
    isDirectory: false,
    isRoot: false,
    showDirectoryActions: false,
    showFileActions: true,
    showReveal: true,
  });
  assert.deepEqual(capabilities({ path: 'src', kind: 'directory' }, false), {
    isDirectory: true,
    isRoot: false,
    showDirectoryActions: true,
    showFileActions: false,
    showReveal: true,
  });
  assert.deepEqual(capabilities({ path: '', kind: 'directory', root: true }, false), {
    isDirectory: true,
    isRoot: true,
    showDirectoryActions: false,
    showFileActions: false,
    showReveal: false,
  });
});

test('Project tree menu omits directory-only actions for files and normal root actions', () => {
  const menu = menuBlock();
  assert.match(
    menu,
    /const \{ isDirectory, isRoot, showDirectoryActions, showFileActions, showReveal \} =\s*projectRowMenuCapabilities\(\s*row,\s*filteredView,?\s*\);/u,
  );
  assert.match(menu, /\.\.\.\(showReveal\s*\? \[[\s\S]*?id: 'reveal'[\s\S]*?\]\s*: \[\]\)/u);
  assert.match(
    menu,
    /\.\.\.\(showDirectoryActions\s*\? \[[\s\S]*?id: 'stageHere'[\s\S]*?id: 'unstageHere'[\s\S]*?\]\s*: \[\]\)/u,
  );
  assert.doesNotMatch(menu, /disabled: isRoot \|\| !isDirectory/u);
  assert.doesNotMatch(menu, /id: 'open'/u);
  assert.equal((menu.match(/t\('editor\.expandFolder'\)/gu) ?? []).length, 1);
});
