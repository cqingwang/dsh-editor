import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

function rememberHarness() {
  let history = [];
  const stored = [];
  const rememberClosed = loadTypeScriptCallback(source, 'rememberClosed', {
    setClosedHistory: (updater) => {
      history = updater(history);
    },
    currentTerminalScope: () => 'session',
    window: {
      localStorage: {
        setItem: (key, value) => stored.push([key, value]),
      },
    },
  });
  return { rememberClosed, history: () => history, stored };
}

function reopenHarness(created, manualTitle) {
  const calls = [];
  const renamed = new Set();
  let terminals = [];
  const reopenClosed = loadTypeScriptCallback(source, 'reopenClosed', {
    callTerminal: async (payload) => {
      calls.push(payload);
      if (payload.op === 'shells') return { shells: [{ path: '/bin/zsh' }] };
      if (payload.op === 'rename') {
        return { terminal: { ...created, title: payload.title, manualTitle: true } };
      }
      return {};
    },
    createTerminal: async () => {
      terminals = [created];
      return created;
    },
    renamedRef: { current: renamed },
    setTerminals: (updater) => {
      terminals = updater(terminals);
    },
    emulatorRef: { current: { focus: () => {} } },
    window: { setTimeout: (callback) => callback() },
  });
  return { reopenClosed, calls, renamed, terminals: () => terminals, manualTitle };
}

test('closed history records whether the title was manually renamed', () => {
  const harness = rememberHarness();
  harness.rememberClosed({
    id: 'term',
    shell: '/bin/zsh',
    cwd: '/tmp',
    title: 'My Shell',
    manualTitle: true,
  });
  assert.deepEqual(harness.history(), [
    {
      shell: '/bin/zsh',
      cwd: '/tmp',
      title: 'My Shell',
      manualTitle: true,
    },
  ]);
  assert.equal(harness.stored.length, 1);
});

test('reopening a manually renamed terminal restores its title through the host', async () => {
  const created = { id: 'restored', title: 'zsh', cwd: '/tmp', shell: '/bin/zsh', manualTitle: false };
  const harness = reopenHarness(created, true);

  await harness.reopenClosed({
    shell: '/bin/zsh',
    cwd: '/tmp',
    title: 'My Shell',
    manualTitle: true,
  });

  assert.deepEqual(
    harness.calls.filter((call) => call.op === 'rename'),
    [{ op: 'rename', id: 'restored', title: 'My Shell' }],
  );
  assert.equal(harness.renamed.has('restored'), true);
  assert.equal(harness.terminals()[0].title, 'My Shell');
  assert.equal(harness.terminals()[0].manualTitle, true);
});

test('reopening an automatically titled terminal does not freeze its shell title', async () => {
  const created = { id: 'restored', title: 'zsh', cwd: '/tmp', shell: '/bin/zsh', manualTitle: false };
  const harness = reopenHarness(created, false);

  await harness.reopenClosed({
    shell: '/bin/zsh',
    cwd: '/tmp',
    title: 'zsh',
    manualTitle: false,
  });

  assert.equal(
    harness.calls.some((call) => call.op === 'rename'),
    false,
  );
  assert.equal(harness.renamed.has('restored'), false);
});
