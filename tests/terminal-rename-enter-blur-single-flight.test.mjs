import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function renameHarness() {
  const pending = [];
  const state = {
    renaming: { id: 'tab-a', value: 'renamed', previous: 'old' },
    terminals: [
      { id: 'tab-a', title: 'old' },
      { id: 'tab-b', title: 'other' },
    ],
    error: null,
  };
  const scope = {
    renamedRef: { current: new Set() },
    renameInFlightRef: { current: null },
    callTerminal: () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    setTerminals: (update) => {
      state.terminals = typeof update === 'function' ? update(state.terminals) : update;
    },
    setRenaming: (update) => {
      state.renaming = typeof update === 'function' ? update(state.renaming) : update;
      scope.renaming = state.renaming;
    },
    setError: (value) => {
      state.error = value;
    },
    renaming: state.renaming,
  };
  scope.commitRename = loadTypeScriptCallback(panelSource, 'commitRename', scope);
  return { scope, state, pending };
}

test('Enter followed by blur sends only one in-flight Terminal rename', async () => {
  const { scope, pending } = renameHarness();
  const first = scope.commitRename();
  const second = scope.commitRename();
  assert.equal(pending.length, 1);

  pending[0].resolve({ terminal: { id: 'tab-a', title: 'renamed' } });
  await Promise.all([first, second]);
});

test('an older rename success cannot close the newer tab rename input', async () => {
  const { scope, state, pending } = renameHarness();
  const first = scope.commitRename();
  scope.renaming = { id: 'tab-b', value: 'other renamed', previous: 'other' };
  state.renaming = scope.renaming;
  const second = scope.commitRename();
  assert.equal(pending.length, 2);

  pending[0].resolve({ terminal: { id: 'tab-a', title: 'renamed' } });
  await first;
  assert.equal(state.renaming.id, 'tab-b');
  assert.equal(state.renaming.value, 'other renamed');

  pending[1].resolve({ terminal: { id: 'tab-b', title: 'other renamed' } });
  await second;
  assert.equal(state.renaming, null);
});
