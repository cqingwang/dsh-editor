import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const projectSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('terminal Find follows the pane that opened it and falls back left', () => {
  const { terminalFindPaneEmulator } = loadTypeScriptModule(terminalSource, ['terminalFindPaneEmulator']);
  const left = { id: 'left' };
  const right = { id: 'right' };

  assert.equal(terminalFindPaneEmulator('left', left, right), left);
  assert.equal(terminalFindPaneEmulator('right', left, right), right);
  assert.equal(terminalFindPaneEmulator('right', left, null), left);
});

test('split Find counts, steps and returns focus through the tracked pane', () => {
  assert.match(panelSource, /const findPaneRef = React\.useRef<'left' \| 'right'>\('left'\)/u);
  assert.match(panelSource, /findPaneRef\.current = pane/u);
  assert.match(
    panelSource,
    /terminalFindPaneEmulator\(findPaneRef\.current, emulatorRef\.current, splitEmulatorRef\.current\)/u,
  );
  assert.match(panelSource, /moveTerminalSelection\(findEmulator\(\), find/u);
  assert.match(panelSource, /onFind: \(\) => openTerminalFind\(emulator, pane\)/u);
  assert.match(projectSource, /document\.activeElement\?\.closest\('\[data-dsh-terminal-pane\]'\) != null\) return;/u);
});
