import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('terminal cwd pruning keeps only live terminal identities', () => {
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const cwdById = new Map([
    ['alive-a', '/repo/a'],
    ['closed', '/repo/closed'],
    ['alive-b', '/repo/b'],
  ]);

  pruneTerminalCwdMetadata(cwdById, ['alive-a', 'alive-b']);

  assert.deepEqual(
    [...cwdById],
    [
      ['alive-a', '/repo/a'],
      ['alive-b', '/repo/b'],
    ],
  );
});

test('closing a terminal prunes its cwd metadata immediately', async () => {
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const cwdById = new Map([
    ['a', '/repo/a'],
    ['b', '/repo/b'],
  ]);
  const closeTerminal = loadTypeScriptCallback(source, 'closeTerminal', {
    closingTerminalIdsRef: { current: new Set() },
    terminalsRef: { current: [{ id: 'a' }, { id: 'b' }] },
    focusedPaneRef: { current: 'left' },
    splitIdRef: { current: null },
    activeRef: { current: 'a' },
    editorIdsRef: { current: [] },
    terminalCwdRef: { current: cwdById },
    pruneTerminalCwdMetadata,
    terminalLiveCwds,
    pruneTerminalReadmeMetadata,
    setReadmePaths: () => {},
    rememberClosed: () => {},
    forgetTerminalLiveBuffer: () => {},
    setColors: (updater) => updater({}),
    writeTerminalColors: () => {},
    setTerminals: () => {},
    setActiveId: () => {},
    setError: () => {},
    terminalErrorAfterTabClosed: () => null,
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    emulatorRef: { current: { focus: () => {} } },
    tabStripRef: { current: { querySelectorAll: () => [] } },
    focusTerminalTabById: () => {},
    callTerminal: async () => ({}),
    writeTerminalRestoreSnapshots: () => {},
    terminalActiveAfterClose: () => 'a',
    document: { activeElement: null },
    HTMLElement: class {},
  });

  await closeTerminal('b');

  assert.equal(cwdById.has('b'), false);
  assert.equal(cwdById.get('a'), '/repo/a');
});

test('Close Other Terminals prunes every doomed cwd entry', async () => {
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const cwdById = new Map([
    ['keep', '/repo/keep'],
    ['closed-a', '/repo/a'],
    ['closed-b', '/repo/b'],
    ['editor', '/repo/editor'],
  ]);
  const closed = [];
  const closeOtherTerminals = loadTypeScriptCallback(source, 'closeOtherTerminals', {
    terminalsRef: {
      current: [{ id: 'keep' }, { id: 'closed-a' }, { id: 'closed-b' }, { id: 'editor' }],
    },
    editorIdsRef: { current: ['editor'] },
    terminalCwdRef: { current: cwdById },
    pruneTerminalCwdMetadata,
    terminalLiveCwds,
    pruneTerminalReadmeMetadata,
    setReadmePaths: () => {},
    closingTerminalIdsRef: { current: new Set() },
    rememberClosed: () => {},
    forgetTerminalLiveBuffer: () => {},
    setColors: (updater) => updater({}),
    writeTerminalColors: () => {},
    setTerminals: () => {},
    setActiveId: () => {},
    setSplitId: () => {},
    setFocusedPane: () => {},
    setError: () => {},
    terminalErrorAfterTabClosed: () => null,
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    emulatorRef: { current: { focus: () => {} } },
    callTerminal: async (request) => {
      closed.push(request.id);
      return {};
    },
  });

  await closeOtherTerminals('keep');

  assert.deepEqual(
    [...cwdById],
    [
      ['keep', '/repo/keep'],
      ['editor', '/repo/editor'],
    ],
  );
  assert.deepEqual(closed.sort(), ['closed-a', 'closed-b']);
});

test('host terminal refresh prunes cwd metadata for reaped identities', async () => {
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const cwdById = new Map([
    ['alive', '/repo/alive'],
    ['host-closed', '/repo/closed'],
  ]);
  const states = {};
  const refresh = loadTypeScriptCallback(source, 'refresh', {
    refreshRequestRef: { current: 0 },
    callTerminal: async () => ({
      available: true,
      terminals: [{ id: 'alive' }],
    }),
    reconcileTerminalDockState: () => ({
      editorIds: [],
      activeId: 'alive',
    }),
    terminalCwdRef: { current: cwdById },
    editorIdsRef: { current: [] },
    activeRef: { current: 'alive' },
    pruneTerminalCwdMetadata,
    terminalLiveCwds,
    pruneTerminalReadmeMetadata,
    setReadmePaths: () => {},
    setAvailable: (value) => {
      states.available = value;
    },
    setTerminals: (value) => {
      states.terminals = value;
    },
    setEditorIds: (value) => {
      states.editorIds = value;
    },
    setActiveId: (value) => {
      states.activeId = value;
    },
    setError: (value) => {
      states.error = value;
    },
    setLoaded: (value) => {
      states.loaded = value;
    },
  });

  await refresh();

  assert.deepEqual([...cwdById], [['alive', '/repo/alive']]);
  assert.equal(states.activeId, 'alive');
  assert.equal(states.loaded, true);
});
