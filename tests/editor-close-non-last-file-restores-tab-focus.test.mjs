import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('closing a non-last file returns focus to the remaining active tab', () => {
  let focusedPath = null;
  const body = { isConnected: true };
  const activeTab = {
    isConnected: true,
    getAttribute: (name) => (name === 'data-dsh-editor-file-tab-path' ? 'package.json' : null),
    focus() {
      focusedPath = 'package.json';
    },
  };
  const closeFile = loadTypeScriptCallback(workspaceSource, 'closeFile', {
    closeSplitTab: () => {},
    t: (key) => key,
    openFilesRef: {
      current: [
        { path: 'package.json', dirty: false },
        { path: 'README.md', dirty: false },
      ],
    },
    modelsRef: { current: new Map() },
    previewPathRef: { current: null },
    setPreviewPath: () => {},
    setOpenFiles: () => {},
    activePathRef: { current: 'package.json' },
    setActivePath: () => {},
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    document: {
      activeElement: body,
      body,
      querySelectorAll: () => [activeTab],
      querySelector: () => null,
    },
    focusWorkspaceFallback: () => true,
  });

  closeFile('README.md', true);
  assert.equal(focusedPath, 'package.json');
});
