import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TerminalHub, terminalProcessCwd } from '../lib/terminal.js';
import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('the Host resolves a live terminal process cwd without OSC 7', async (t) => {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    t.skip('process cwd fallback is implemented for macOS and Linux');
    return;
  }
  assert.equal(await terminalProcessCwd(process.pid), process.cwd());
});

test('TerminalHub cwd updates the host metadata and rejects unknown ids', async () => {
  const hub = new TerminalHub({ ctx: { effect() {} }, subprocess: {} });
  const terminal = { handle: { pid: process.pid }, meta: { cwd: '/initial' } };
  hub.sessions.set('session', new Map([['terminal', terminal]]));
  assert.equal(await hub.cwd('session', 'terminal'), process.cwd());
  assert.equal(terminal.meta.cwd, process.cwd());
  await assert.rejects(() => hub.cwd('session', 'missing'), /terminal not found/u);
});

test('the terminal route exposes the cwd fallback', () => {
  assert.match(hostSource, /case 'cwd':\s+return ok\(\{ cwd: await terminals\.cwd/u);
});

test('the tab menu asks the Host for cwd before building path actions', async () => {
  const synced = [];
  const refreshTerminalCwd = loadTypeScriptCallback(panelSource, 'refreshTerminalCwd', {
    callTerminal: async () => ({ cwd: '/tmp' }),
    syncTerminalCwd: (id, cwd) => synced.push([id, cwd]),
  });
  assert.equal(await refreshTerminalCwd('terminal', '/repo'), '/tmp');
  assert.deepEqual(synced, [['terminal', '/tmp']]);

  const failed = loadTypeScriptCallback(panelSource, 'refreshTerminalCwd', {
    callTerminal: async () => {
      throw new Error('process table unavailable');
    },
    syncTerminalCwd: () => {
      throw new Error('must not sync a failed lookup');
    },
  });
  assert.equal(await failed('terminal', '/repo'), '/repo');
  assert.match(panelSource, /const openTerminalTabMenu = async/u);
  assert.match(panelSource, /await refreshTerminalCwd\(terminal\.id,/u);
  assert.match(panelSource, /duplicate: \(\) => void createTerminal\(terminal\.shell, cwd\)/u);
  assert.match(panelSource, /revealCwd: \(\) => void revealTerminalDirectory\(cwd\)/u);
  assert.match(panelSource, /openReadme: \(\) => void openTerminalReadme\(cwd\)/u);
});

test('activating a terminal tab refreshes cwd with a bounded throttle', () => {
  const due = loadTypeScriptFunction(panelSource, 'terminalCwdRefreshDue');
  assert.equal(due(0, 1999), false);
  assert.equal(due(0, 2000), true);
  assert.equal(due(2000, 2500), false);
  assert.match(panelSource, /terminalCwdRefreshDue\(last, now\)/u);
  assert.match(panelSource, /terminalCwdRefreshRef\.current\.set\(terminal\.id, now\)/u);
  assert.match(panelSource, /refreshTerminalCwdIfStale\(terminal\);/u);
  assert.match(panelSource, /activateTerminalTab\(terminal\);\s+window\.setTimeout\(\(\) => focusTerminalTab/u);
});
