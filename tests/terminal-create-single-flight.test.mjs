import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function createHarness() {
  const pending = [];
  const state = {
    busy: false,
    error: null,
    terminals: [],
    activeId: null,
  };
  const createInFlightRef = { current: false };
  const createTerminal = loadTypeScriptCallback(panelSource, 'createTerminal', {
    createInFlightRef,
    awaitMeasured: async () => ({ cols: 100, rows: 30 }),
    describeCreateFailure: (failure) => (failure instanceof Error ? failure.message : String(failure)),
    terminalCreateFailureLimitReached: () => false,
    startDirectory: undefined,
    onStartDirectoryUsed: undefined,
    beginBusyOperation: () => {
      state.busy = true;
    },
    endBusyOperation: () => {
      state.busy = false;
    },
    setBusy: (value) => {
      state.busy = value;
    },
    setError: (value) => {
      state.error = value;
    },
    callTerminal: () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    userClosedLastRef: { current: false },
    seedTerminalRestoreBuffer: () => {},
    setTerminals: (update) => {
      state.terminals = typeof update === 'function' ? update(state.terminals) : update;
    },
    setActiveId: (value) => {
      state.activeId = value;
    },
  });
  return { createTerminal, createInFlightRef, pending, state };
}

test('two same-turn Terminal create requests send only one Host create', async () => {
  const { createTerminal, createInFlightRef, pending, state } = createHarness();
  const first = createTerminal();
  const second = createTerminal();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(createInFlightRef.current, true);
  assert.equal(pending.length, 1);

  pending[0].resolve({ terminal: { id: 'tab-a', title: 'zsh', shell: '/bin/zsh', cwd: '/repo' } });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.id, 'tab-a');
  assert.equal(secondResult, null);
  assert.equal(createInFlightRef.current, false);
  assert.equal(state.activeId, 'tab-a');
  assert.equal(state.busy, false);
});

test('a failed create releases the single-flight guard for retry', async () => {
  const { createTerminal, createInFlightRef, pending } = createHarness();
  const first = createTerminal();
  await Promise.resolve();
  await Promise.resolve();
  pending[0].reject(new Error('create failed'));
  assert.equal(await first, null);
  assert.equal(createInFlightRef.current, false);

  const retry = createTerminal();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(pending.length, 2);
  pending[1].resolve({ terminal: { id: 'tab-b', title: 'zsh', shell: '/bin/zsh', cwd: '/repo' } });
  assert.equal((await retry).id, 'tab-b');
});
