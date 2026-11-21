import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('profile restore passes each terminal working directory back to create', async () => {
  const createCalls = [];
  const restoreTerminals = loadTypeScriptCallback(panelSource, 'restoreTerminals', {
    readTerminalRestoreSnapshots: () => ['snapshot-a', 'snapshot-b'],
    createFailureRef: { current: null },
    setError: () => {},
    callTerminal: async () => ({
      shells: [{ path: '/bin/zsh' }, { path: '/bin/bash' }],
    }),
    createTerminal: async (...args) => {
      createCalls.push(args);
      return { id: `terminal-${createCalls.length}` };
    },
  });

  await restoreTerminals([
    { shell: '/bin/zsh', cwd: '/workspace/a', title: 'a' },
    { shell: '/bin/bash', cwd: '/workspace/b', title: 'b' },
  ]);

  assert.deepEqual(createCalls, [
    ['/bin/zsh', '/workspace/a', 'snapshot-a'],
    ['/bin/bash', '/workspace/b', 'snapshot-b'],
  ]);
});

test('one failed profile entry does not prevent later entries from restoring', async () => {
  const createCalls = [];
  const restoreTerminals = loadTypeScriptCallback(panelSource, 'restoreTerminals', {
    readTerminalRestoreSnapshots: () => ['snapshot-a', 'snapshot-b'],
    createFailureRef: { current: null },
    setError: () => {},
    callTerminal: async () => ({
      shells: [{ path: '/bin/zsh' }, { path: '/bin/bash' }],
    }),
    createTerminal: async (...args) => {
      createCalls.push(args);
      return createCalls.length === 1 ? null : { id: 'terminal-b' };
    },
  });

  await restoreTerminals([
    { shell: '/bin/zsh', cwd: '/missing/a', title: 'a' },
    { shell: '/bin/bash', cwd: '/workspace/b', title: 'b' },
  ]);

  assert.deepEqual(createCalls, [
    ['/bin/zsh', '/missing/a', 'snapshot-a'],
    ['/bin/bash', '/workspace/b', 'snapshot-b'],
  ]);
});

test('a partial profile restore keeps the failed entry visible', async () => {
  const errors = [];
  let createCount = 0;
  const failure = { message: 'missing terminal directory', limitReached: false };
  const createFailureRef = { current: null };
  const restoreTerminals = loadTypeScriptCallback(panelSource, 'restoreTerminals', {
    readTerminalRestoreSnapshots: () => ['snapshot-a', 'snapshot-b'],
    callTerminal: async () => ({
      shells: [{ path: '/bin/zsh' }, { path: '/bin/bash' }],
    }),
    createFailureRef,
    setError: (value) => errors.push(value),
    createTerminal: async () => {
      createCount += 1;
      if (createCount === 1) {
        createFailureRef.current = failure;
        return null;
      }
      createFailureRef.current = null;
      return { id: 'terminal-b' };
    },
  });

  await restoreTerminals([
    { shell: '/bin/zsh', cwd: '/missing/a', title: 'a' },
    { shell: '/bin/bash', cwd: '/workspace/b', title: 'b' },
  ]);

  assert.equal(createCount, 2);
  assert.deepEqual(errors.at(-1), failure);
});
