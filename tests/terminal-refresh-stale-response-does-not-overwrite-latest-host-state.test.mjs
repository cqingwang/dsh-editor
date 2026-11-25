import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function loadRefresh() {
  const pending = [];
  const state = {
    available: null,
    terminals: [],
    editorIds: [],
    activeId: null,
    error: null,
    loaded: false,
  };
  const refresh = loadTypeScriptCallback(panelSource, 'refresh', {
    refreshRequestRef: { current: 0 },
    editorIdsRef: { current: [] },
    activeRef: { current: null },
    callTerminal: () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    reconcileTerminalDockState: (listed, editorIds) => ({
      editorIds,
      activeId: listed[0]?.id ?? null,
    }),
    pruneTerminalCwdMetadata: () => {},
    terminalCwdRef: { current: new Map() },
    terminalMetadataRef: { current: new Map() },
    terminalLiveCwds: () => [],
    pruneTerminalReadmeMetadata: (current) => current,
    setReadmePaths: () => {},
    setAvailable: (value) => {
      state.available = value;
    },
    setTerminals: (value) => {
      state.terminals = value;
    },
    setEditorIds: (value) => {
      state.editorIds = value;
    },
    setActiveId: (value) => {
      state.activeId = value;
    },
    setError: (value) => {
      state.error = value;
    },
    setLoaded: (value) => {
      state.loaded = value;
    },
  });
  return { refresh, pending, state };
}

test('a stale Terminal refresh cannot roll back the newer host list', async () => {
  const { refresh, pending, state } = loadRefresh();
  const first = refresh();
  const second = refresh();

  pending[1].resolve({
    available: true,
    terminals: [{ id: 'new', title: 'new', shell: '/bin/zsh', cwd: '/new' }],
  });
  await second;
  assert.equal(state.available, true);
  assert.equal(state.terminals[0].id, 'new');
  assert.equal(state.activeId, 'new');

  pending[0].resolve({
    available: false,
    terminals: [{ id: 'old', title: 'old', shell: '/bin/bash', cwd: '/old' }],
  });
  await first;
  assert.equal(state.available, true);
  assert.equal(state.terminals[0].id, 'new');
  assert.equal(state.activeId, 'new');
  assert.equal(state.loaded, true);
});

test('a stale Terminal refresh failure cannot poison the newer success', async () => {
  const { refresh, pending, state } = loadRefresh();
  const first = refresh();
  const second = refresh();

  pending[1].resolve({
    available: true,
    terminals: [{ id: 'new', title: 'new', shell: '/bin/zsh', cwd: '/new' }],
  });
  await second;
  assert.equal(state.error, null);

  pending[0].reject(new Error('stale terminal list failed'));
  await first;
  assert.equal(state.error, null);
  assert.equal(state.terminals[0].id, 'new');
  assert.equal(state.loaded, true);
});
