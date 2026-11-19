import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function loadOpenFile({ callFs, noteRecent, setEditorError = () => {} }) {
  return loadTypeScriptCallback(workspaceSource, 'openFile', {
    noteRecent,
    previewTabEnabled: false,
    openFilesRef: { current: [] },
    openingRef: { current: new Set() },
    setDiffActive: () => {},
    isImagePreviewPath: () => false,
    callFs,
    workspaceFileFromResponse: (path) => ({
      path,
      content: '',
      dirty: false,
    }),
    setOpenFiles: () => {},
    setPreviewPath: () => {},
    setActivePath: () => {},
    setEditorError,
    previewPathRef: { current: null },
    modelsRef: { current: new Map() },
  });
}

test('a failed file read does not promote the missing path into Recent Files', async () => {
  const recent = [];
  const errors = [];
  const openFile = loadOpenFile({
    noteRecent: (path) => recent.push(path),
    callFs: async () => {
      throw new Error('ENOENT: file no longer exists');
    },
    setEditorError: (message) => errors.push(message),
  });

  assert.equal(await openFile('deleted/file.ts'), false);
  assert.deepEqual(recent, []);
  assert.deepEqual(errors, ['ENOENT: file no longer exists']);
});

test('the same file is promoted into Recent Files only after a successful read', async () => {
  const recent = [];
  const openFile = loadOpenFile({
    noteRecent: (path) => recent.push(path),
    callFs: async () => ({
      content: 'export const value = 1;\n',
      mtimeMs: 1,
      size: 25,
    }),
  });

  assert.equal(await openFile('src/value.ts'), true);
  assert.deepEqual(recent, ['src/value.ts']);
});
