import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function cwdHarness({ knownCwd, reportedCwd, listed = true }) {
  const cwdById = new Map(knownCwd === undefined ? [] : [['terminal-a', knownCwd]]);
  let stateUpdates = 0;
  const syncTerminalCwd = loadTypeScriptCallback(source, 'syncTerminalCwd', {
    terminalsRef: {
      current: listed ? [{ id: 'terminal-a', cwd: knownCwd ?? '' }] : [],
    },
    terminalCwdRef: { current: cwdById },
    setTerminals: (updater) => {
      stateUpdates += 1;
      updater([{ id: 'terminal-a', cwd: knownCwd ?? '' }]);
    },
  });
  return { syncTerminalCwd, cwdById, stateUpdates: () => stateUpdates };
}

test('OSC 7 with an unchanged cwd does not enqueue a terminal state update', () => {
  const harness = cwdHarness({ knownCwd: '/repo', reportedCwd: '/repo' });

  harness.syncTerminalCwd('terminal-a', '/repo');

  assert.equal(harness.stateUpdates(), 0);
  assert.equal(harness.cwdById.get('terminal-a'), '/repo');
});

test('OSC 7 with a changed cwd updates state and the live cwd cache once', () => {
  const harness = cwdHarness({ knownCwd: '/repo', reportedCwd: '/repo/sub' });

  harness.syncTerminalCwd('terminal-a', '/repo/sub');

  assert.equal(harness.stateUpdates(), 1);
  assert.equal(harness.cwdById.get('terminal-a'), '/repo/sub');
});

test('OSC 7 for an unlisted terminal does not create orphan cwd metadata', () => {
  const harness = cwdHarness({ knownCwd: undefined, reportedCwd: '/repo', listed: false });

  harness.syncTerminalCwd('terminal-a', '/repo');

  assert.equal(harness.stateUpdates(), 0);
  assert.equal(harness.cwdById.has('terminal-a'), false);
});
