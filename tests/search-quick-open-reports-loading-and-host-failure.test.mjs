import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const quickOpenSource = await readFile(
  new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url),
  'utf8',
);

function loadOpenQuickOpen(callFs) {
  let state = null;
  const quickOpenFilesRequestRef = { current: 0 };
  const quickOpenFilesAbortRef = { current: null };
  const openQuickOpen = loadTypeScriptCallback(workspaceSource, 'openQuickOpen', {
    rememberQuickOpenOrigin: () => {},
    setPaletteMode: () => {},
    quickOpenFilesRequestRef,
    quickOpenFilesAbortRef,
    setQuickOpen(update) {
      state = typeof update === 'function' ? update(state) : update;
    },
    callFs,
  });
  return {
    openQuickOpen,
    state: () => state,
  };
}

test('Go to File reports loading until the host file list arrives', async () => {
  let resolveFiles;
  const palette = loadOpenQuickOpen(
    () =>
      new Promise((resolve) => {
        resolveFiles = resolve;
      }),
  );

  const pending = palette.openQuickOpen();
  assert.deepEqual(palette.state(), {
    query: '',
    index: 0,
    loading: true,
    error: null,
  });
  resolveFiles({ files: ['README.md'] });
  await pending;
  assert.deepEqual(palette.state(), {
    query: '',
    index: 0,
    files: ['README.md'],
    loading: false,
    error: null,
  });
});

test('Go to File surfaces a host enumeration failure instead of an empty result', async () => {
  const palette = loadOpenQuickOpen(async () => {
    throw new Error('workspace listing failed');
  });

  await palette.openQuickOpen();
  assert.deepEqual(palette.state(), {
    query: '',
    index: 0,
    files: [],
    loading: false,
    error: 'workspace listing failed',
  });
  assert.match(quickOpenSource, /role='alert'>\s*\{error\}\s*<\/div>/u);
  assert.match(quickOpenSource, /error === null && matches\.length === 0 && !loading/u);
});
