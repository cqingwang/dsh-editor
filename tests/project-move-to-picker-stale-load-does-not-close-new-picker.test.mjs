import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('a superseded Move To request cannot close the newer picker', async () => {
  let state = null;
  const requests = [];
  const treeErrors = [];
  const moveToRequestRef = { current: 0 };
  const moveToAbortRef = { current: null };
  const openMoveTo = loadTypeScriptCallback(source, 'openMoveTo', {
    selection: new Set(),
    dirname: (path) => path.slice(0, path.lastIndexOf('/')),
    rememberPaletteOrigin: () => {},
    projectName: 'project',
    moveToRequestRef,
    moveToAbortRef,
    setMoveTo: (update) => {
      state = typeof update === 'function' ? update(state) : update;
    },
    closeMoveTo: () => {
      state = null;
    },
    setTreeError: (message) => treeErrors.push(message),
    callFs: (_payload, options) =>
      new Promise((resolve, reject) => {
        requests.push({ resolve, reject, signal: options?.signal });
      }),
  });

  const first = openMoveTo('old/file.ts');
  const firstSignal = requests[0].signal;
  const second = openMoveTo('new/file.ts');

  assert.equal(firstSignal.aborted, true);
  requests[0].reject(new Error('old request failed'));
  requests[1].resolve({ directories: ['new'] });
  await Promise.all([first, second]);

  assert.deepEqual(state.sources, ['new/file.ts']);
  assert.deepEqual(state.directories, ['new']);
  assert.equal(state.loading, false);
  assert.deepEqual(treeErrors, []);
});

test('closing Move To invalidates the in-flight request', () => {
  const start = source.indexOf('const closeMoveTo = React.useCallback');
  const end = source.indexOf('\n  }, [', start);
  const closeBlock = source.slice(start, end);

  assert.match(closeBlock, /moveToRequestRef\.current \+= 1;/u);
  assert.match(closeBlock, /moveToAbortRef\.current\?\.abort\(\);/u);
});
