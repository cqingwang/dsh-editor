import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('a stale shell-menu failure cannot overwrite the newer menu', async () => {
  const pending = [];
  let menu = null;
  let error = null;
  let busy = false;
  const shellMenuRequestRef = { current: 0 };
  const openShellMenu = loadTypeScriptCallback(panelSource, 'openShellMenu', {
    newButtonRef: {
      current: {
        getBoundingClientRect: () => ({ left: 10, bottom: 20 }),
      },
    },
    shellMenuRequestRef,
    beginBusyOperation: () => {
      busy = true;
    },
    endBusyOperation: () => {
      busy = false;
    },
    setBusy: (value) => {
      busy = value;
    },
    setError: (value) => {
      error = value;
    },
    setShellMenu: (value) => {
      menu = value;
    },
    callTerminal: () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    createTerminal: () => {},
    t: (key) => key,
  });

  const first = openShellMenu();
  const second = openShellMenu();
  assert.equal(shellMenuRequestRef.current, 2);

  pending[1].resolve({ shells: [{ path: '/bin/zsh', name: 'zsh' }] });
  await second;
  assert.equal(menu.items[0].label, 'zsh');
  assert.equal(busy, false);

  pending[0].reject(new Error('stale shell lookup failed'));
  await first;
  assert.equal(error, null);
  assert.equal(menu.items[0].label, 'zsh');
  assert.equal(busy, false);
});

test('the shell-menu request generation is isolated from newer requests', async () => {
  const pending = [];
  let menu = null;
  let error = null;
  let busy = false;
  const openShellMenu = loadTypeScriptCallback(panelSource, 'openShellMenu', {
    newButtonRef: { current: null },
    shellMenuRequestRef: { current: 0 },
    beginBusyOperation: () => {
      busy = true;
    },
    endBusyOperation: () => {
      busy = false;
    },
    setBusy: (value) => {
      busy = value;
    },
    setError: (value) => {
      error = value;
    },
    setShellMenu: (value) => {
      menu = value;
    },
    callTerminal: () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    createTerminal: () => {},
    t: (key) => key,
  });

  const first = openShellMenu();
  const second = openShellMenu();
  pending[0].resolve({ shells: [{ path: '/bin/bash', name: 'bash' }] });
  await first;
  assert.equal(menu, null);

  pending[1].resolve({ shells: [{ path: '/bin/zsh', name: 'zsh' }] });
  await second;
  assert.equal(menu.items[0].label, 'zsh');
  assert.equal(error, null);
  assert.equal(busy, false);
});
