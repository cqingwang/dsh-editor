import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('a superseded Revision Picker request cannot close the newer picker', async () => {
  let state = null;
  const requests = [];
  const editorErrors = [];
  const revisionPickerRequestRef = { current: 0 };
  const revisionPickerAbortRef = { current: null };
  const compareWithRevision = loadTypeScriptCallback(source, 'compareWithRevision', {
    rememberPaletteOrigin: () => {},
    revisionPickerRequestRef,
    revisionPickerAbortRef,
    setRevisionPicker: (update) => {
      state = typeof update === 'function' ? update(state) : update;
    },
    setEditorError: (message) => editorErrors.push(message),
    closeRevisionPicker: () => {
      state = null;
    },
    callGit: (_payload, options) =>
      new Promise((resolve, reject) => {
        requests.push({ resolve, reject, signal: options?.signal });
      }),
  });

  const first = compareWithRevision('src/old.ts');
  const firstSignal = requests[0].signal;
  const second = compareWithRevision('src/new.ts');

  assert.equal(firstSignal.aborted, true);
  requests[0].reject(new Error('old request failed'));
  requests[1].resolve({ commits: [{ hash: 'new' }] });
  await Promise.all([first, second]);

  assert.equal(state.path, 'src/new.ts');
  assert.deepEqual(state.commits, [{ hash: 'new' }]);
  assert.equal(state.loading, false);
  assert.deepEqual(editorErrors, []);
});

test('closing Revision Picker invalidates the in-flight request', () => {
  const start = source.indexOf('const closeRevisionPicker = React.useCallback');
  const end = source.indexOf('\n  }, [', start);
  const closeBlock = source.slice(start, end);

  assert.match(closeBlock, /revisionPickerRequestRef\.current \+= 1;/u);
  assert.match(closeBlock, /revisionPickerAbortRef\.current\?\.abort\(\);/u);
});
