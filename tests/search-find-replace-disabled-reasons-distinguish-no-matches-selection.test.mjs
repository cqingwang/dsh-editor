import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, ['findReplaceDisabledReasons']);
const t = (key) => key;

test('zero matches explains that neither Replace action has anything to target', () => {
  const reasons = helpers.findReplaceDisabledReasons({
    matchCount: 0,
    activeKind: null,
    t,
  });

  assert.deepEqual(reasons, {
    all: 'editor.findReplaceAllDisabled',
    current: 'editor.findReplaceAllDisabled',
  });
});

test('a real match disables only Replace until a text occurrence is selected', () => {
  const fileActive = helpers.findReplaceDisabledReasons({
    matchCount: 1,
    activeKind: 'file',
    t,
  });
  const textActive = helpers.findReplaceDisabledReasons({
    matchCount: 1,
    activeKind: 'text',
    t,
  });

  assert.deepEqual(fileActive, {
    all: null,
    current: 'editor.findReplaceCurrentDisabled',
  });
  assert.deepEqual(textActive, {
    all: null,
    current: null,
  });
});

test('busy, loading and search failures keep their higher-priority reason', () => {
  assert.deepEqual(
    helpers.findReplaceDisabledReasons({
      replaceBusy: true,
      loading: true,
      error: 'failed',
      matchCount: 0,
      t,
    }),
    {
      all: 'editor.findReplaceBusy',
      current: 'editor.findReplaceBusy',
    },
  );
  assert.deepEqual(
    helpers.findReplaceDisabledReasons({
      loading: true,
      error: 'failed',
      matchCount: 0,
      t,
    }),
    {
      all: 'editor.findReplaceLoading',
      current: 'editor.findReplaceLoading',
    },
  );
  assert.deepEqual(
    helpers.findReplaceDisabledReasons({
      error: 'failed',
      matchCount: 0,
      t,
    }),
    {
      all: 'editor.findReplaceSearchError',
      current: 'editor.findReplaceSearchError',
    },
  );
});
