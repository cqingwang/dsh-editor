import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('a superseded Quick Open file-list response cannot overwrite the newer open', async () => {
  let quickOpen = null;
  const requests = [];
  const quickOpenFilesRequestRef = { current: 0 };
  const quickOpenFilesAbortRef = { current: null };
  const openQuickOpen = loadTypeScriptCallback(source, 'openQuickOpen', {
    rememberQuickOpenOrigin: () => {},
    setPaletteMode: () => {},
    setQuickOpen: (update) => {
      quickOpen = typeof update === 'function' ? update(quickOpen) : update;
    },
    quickOpenFilesRequestRef,
    quickOpenFilesAbortRef,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    callFs: (_payload, options) =>
      new Promise((resolve) => {
        requests.push({ resolve, signal: options?.signal });
      }),
  });

  const first = openQuickOpen();
  const firstSignal = requests[0].signal;
  const second = openQuickOpen();

  assert.equal(firstSignal.aborted, true);
  requests[0].resolve({ files: ['old.ts'] });
  requests[1].resolve({ files: ['new.ts'] });
  await Promise.all([first, second]);

  assert.deepEqual(quickOpen.files, ['new.ts']);
});

test('closing Quick Open immediately invalidates its file request', async () => {
  const closeStart = source.indexOf('const closeQuickOpen = React.useCallback');
  const closeEnd = source.indexOf('\n  }, [', closeStart);
  const closeBlock = source.slice(closeStart, closeEnd);

  assert.match(closeBlock, /quickOpenFilesRequestRef\.current \+= 1;/u);
  assert.match(closeBlock, /quickOpenFilesAbortRef\.current\?\.abort\(\);/u);
});
