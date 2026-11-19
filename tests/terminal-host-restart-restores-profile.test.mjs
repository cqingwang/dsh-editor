import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptModule } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');
const { shouldPersistTerminalProfile, terminalAutoOpenAction } = loadTypeScriptModule(terminalSource, [
  'shouldPersistTerminalProfile',
  'terminalAutoOpenAction',
]);

test('host restart restores the remembered profile instead of clearing it first', () => {
  assert.equal(
    shouldPersistTerminalProfile(0, true, true, false),
    false,
    'an unexpected empty host list must keep the remembered profile for restore',
  );
  assert.equal(
    terminalAutoOpenAction({
      loaded: true,
      available: true,
      busy: false,
      count: 0,
      error: null,
      opened: true,
      userClosedLast: false,
      rememberedCount: 2,
    }),
    'restore',
  );
});

test('closing the last tab still clears profile and closes the tool window', () => {
  assert.equal(shouldPersistTerminalProfile(0, true, true, true), true);
  assert.equal(
    terminalAutoOpenAction({
      loaded: true,
      available: true,
      busy: false,
      count: 0,
      error: null,
      opened: true,
      userClosedLast: true,
      rememberedCount: 0,
    }),
    'close',
  );
});

test('no remembered profile creates a shell while unavailable hosts wait', () => {
  const base = {
    loaded: true,
    available: true,
    busy: false,
    count: 0,
    error: null,
    opened: false,
    userClosedLast: false,
    rememberedCount: 0,
  };
  assert.equal(terminalAutoOpenAction(base), 'create');
  assert.equal(terminalAutoOpenAction({ ...base, available: false }), 'wait');
  assert.equal(terminalAutoOpenAction({ ...base, loaded: false }), 'wait');
  assert.equal(terminalAutoOpenAction({ ...base, count: 1 }), 'wait');
});

test('TerminalPanel wires user close, profile restore and stale snapshot cleanup', () => {
  assert.match(panel, /const userClosedLastRef = React\.useRef\(false\);/u);
  assert.match(panel, /userClosedLastRef\.current = true;\s+writeTerminalRestoreSnapshots\(\[\]\);/u);
  assert.match(panel, /userClosedLastRef\.current = false;\s+seedTerminalRestoreBuffer/u);
  assert.match(
    panel,
    /const action = terminalAutoOpenAction\(\{[\s\S]*?userClosedLast: userClosedLastRef\.current,[\s\S]*?rememberedCount: remembered\.length,/u,
  );
  assert.match(panel, /if \(action === 'close'\)/u);
  assert.match(panel, /if \(action === 'restore'\)/u);
  assert.match(panel, /writeTerminalRestoreSnapshots\(\[\]\);/u);
});
