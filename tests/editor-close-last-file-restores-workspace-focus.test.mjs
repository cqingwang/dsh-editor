import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('closing the last open file restores a stable workspace focus target', () => {
  let focusFallbackCalls = 0;
  let nextActive = 'unchanged';
  const closeFile = loadTypeScriptCallback(workspaceSource, 'closeFile', {
    closeSplitTab: () => {},
    t: (key) => key,
    openFilesRef: {
      current: [{ path: 'README.md', dirty: false }],
    },
    modelsRef: {
      current: new Map(),
    },
    previewPathRef: { current: null },
    setPreviewPath: () => {},
    setOpenFiles: () => {},
    activePathRef: { current: 'README.md' },
    setActivePath: (value) => {
      nextActive = value;
    },
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    document: {
      querySelector: () => null,
    },
    focusWorkspaceFallback: () => {
      focusFallbackCalls += 1;
      return true;
    },
  });

  closeFile('README.md', true);
  assert.equal(nextActive, null);
  assert.equal(focusFallbackCalls, 1);
  assert.match(
    workspaceSource,
    /if \(active !== null && active !== document\.body && active\.isConnected !== false\) return;/u,
  );
  assert.match(
    workspaceSource,
    /focusWorkspaceFallback\(document\.querySelector<HTMLElement>\('\[data-dsh-editor-workspace\]'\)\);/u,
  );
});
