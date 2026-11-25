import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TerminalHub } from '../lib/terminal.js';

const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const areaSource = await readFile(
  new URL('../src/client/components/terminal/EditorTerminalArea.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function createHub() {
  const output = new EventEmitter();
  output.setEncoding = () => {};
  const subprocess = {
    spawnTerminal: async () => ({
      output,
      done: new Promise(() => {}),
      terminate: async () => {},
    }),
    resolveExecutable: async () => '/bin/zsh',
    terminalEnvironment: async () => ({ defaultShell: '/bin/zsh' }),
  };
  return new TerminalHub({
    ctx: { effect: () => {} },
    subprocess,
  });
}

test('the host exposes whether a terminal title was renamed by the user', async () => {
  const hub = createHub();
  const created = await hub.create({ sessionId: 'session', cwd: '/tmp', cols: 80, rows: 24 });

  assert.equal(created.manualTitle, false);
  const renamed = hub.rename('session', created.id, 'My Shell');
  assert.equal(renamed.title, 'My Shell');
  assert.equal(renamed.manualTitle, true);

  const automatic = hub.rename('session', created.id, 'shell title', true);
  assert.equal(automatic.title, 'My Shell');
  assert.equal(automatic.manualTitle, true);
});

test('manual terminal titles are carried into the editor and cannot be overwritten by OSC', () => {
  assert.match(panelSource, /manualTitle: terminal\.manualTitle === true/);
  assert.match(panelSource, /current\?\.manualTitle === true/);
  assert.match(areaSource, /target\?\.manualTitle === true/);
  assert.match(workspaceSource, /terminal\.manualTitle === true \? \{ manualTitle: true \}/);
});
