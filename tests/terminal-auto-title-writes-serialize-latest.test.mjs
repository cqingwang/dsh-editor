import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function titleHarness() {
  const pending = [];
  const requests = [];
  const terminals = [{ id: 'tab-a', title: 'old', cwd: '/workspace' }];
  const scope = {
    renamedRef: { current: new Set() },
    renameInFlightRef: { current: null },
    autoTitleRequestChainRef: { current: new Map() },
    terminalMetadataRef: { current: new Map() },
    terminalManualRenameOwnsTitle: () => false,
    terminalsRef: { current: terminals },
    setTerminals: (update) => {
      const next = typeof update === 'function' ? update(scope.terminalsRef.current) : update;
      scope.terminalsRef.current = next;
    },
    callTerminal: (request) => {
      requests.push(request);
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    },
  };
  scope.syncTerminalTitle = loadTypeScriptCallback(panelSource, 'syncTerminalTitle', scope);
  return { scope, pending, requests };
}

test('rapid OSC titles before dispatch coalesce to the latest title', async () => {
  const { scope, pending, requests } = titleHarness();

  await scope.syncTerminalTitle('tab-a', 'first');
  await scope.syncTerminalTitle('tab-a', 'second');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scope.terminalsRef.current[0].title, 'second');
  assert.equal(pending.length, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].title, 'second');

  pending[0].resolve({ terminal: { id: 'tab-a', title: 'second' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scope.autoTitleRequestChainRef.current.size, 0);
});

test('an OSC title arriving behind an in-flight write runs only after it settles', async () => {
  const { scope, pending, requests } = titleHarness();

  await scope.syncTerminalTitle('tab-a', 'first');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);
  assert.equal(requests[0].title, 'first');

  await scope.syncTerminalTitle('tab-a', 'second');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);
  assert.equal(scope.terminalsRef.current[0].title, 'second');

  pending[0].resolve({ terminal: { id: 'tab-a', title: 'first' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  assert.equal(requests[1].title, 'second');
  assert.equal(requests[1].auto, true);

  pending[1].resolve({ terminal: { id: 'tab-a', title: 'second' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scope.autoTitleRequestChainRef.current.size, 0);
});
