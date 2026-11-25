import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('README pruning keeps shared live cwd entries and drops stale directories', () => {
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const readmeByCwd = {
    '/repo/alive': 'README.md',
    '/repo/closed': 'README.md',
    '/repo/shared': 'docs/README.md',
  };

  const next = pruneTerminalReadmeMetadata(readmeByCwd, ['/repo/alive', '/repo/shared']);

  assert.deepEqual(next, {
    '/repo/alive': 'README.md',
    '/repo/shared': 'docs/README.md',
  });
  assert.notEqual(next, readmeByCwd);
});

test('README pruning preserves the cached object when every cwd stays live', () => {
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const readmeByCwd = {
    '/repo/a': 'README.md',
    '/repo/b': '',
  };

  const next = pruneTerminalReadmeMetadata(readmeByCwd, ['/repo/a', '/repo/b']);

  assert.equal(next, readmeByCwd);
});

test('closing the last terminal using a cwd clears that README entry', async () => {
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const cwdById = new Map([
    ['a', '/repo/a'],
    ['b', '/repo/b'],
  ]);
  let readmeByCwd = {
    '/repo/a': 'README.md',
    '/repo/b': 'README.md',
  };
  const closeTerminal = loadTypeScriptCallback(source, 'closeTerminal', {
    closingTerminalIdsRef: { current: new Set() },
    terminalsRef: { current: [{ id: 'a', cwd: '/repo/a' }, { id: 'b', cwd: '/repo/b' }] },
    focusedPaneRef: { current: 'left' },
    splitIdRef: { current: null },
    activeRef: { current: 'a' },
    editorIdsRef: { current: [] },
    terminalCwdRef: { current: cwdById },
    terminalMetadataRef: { current: new Map() },
    pruneTerminalCwdMetadata,
    terminalLiveCwds,
    pruneTerminalReadmeMetadata,
    setReadmePaths: (updater) => {
      readmeByCwd = typeof updater === 'function' ? updater(readmeByCwd) : updater;
    },
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

  assert.deepEqual(readmeByCwd, {
    '/repo/a': 'README.md',
  });
});

test('README pruning keeps a directory shared by another live terminal', () => {
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const liveCwds = terminalLiveCwds(
    [
      { id: 'a', cwd: '/repo/shared' },
      { id: 'b', cwd: '/repo/shared' },
    ],
    new Map(),
  );

  const next = pruneTerminalReadmeMetadata(
    {
      '/repo/shared': 'README.md',
      '/repo/gone': 'README.md',
    },
    liveCwds,
  );

  assert.deepEqual(next, {
    '/repo/shared': 'README.md',
  });
});
