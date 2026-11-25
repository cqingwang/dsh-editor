import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/terminal/TerminalScreen.tsx'), 'utf8');
const panelSource = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');

test('every emulator callback is registered AND destructured', () => {
  /* Two halves of one contract. `onCwd` was passed by the caller and read from
     `handlersRef`, but neither listed in the ref object nor destructured by
     `TerminalScreen` — so OSC 7 resolved to `undefined` and the terminal pane threw
     `ReferenceError: onCwd is not defined`, blanking the whole dock. */
  /* Round 150 added a second, simpler screen (MeasuringScreen) that registers
     only `onGrid`; the contract under test belongs to TerminalScreen, so its own
     line is selected rather than the first match in the file. */
  const terminalStart = source.indexOf('function TerminalScreen(');
  assert.notEqual(terminalStart, -1);
  const refLine = /handlersRef\.current = \{([\s\S]*?)\};/.exec(source.slice(terminalStart));
  assert.notEqual(refLine, null);
  const registered = refLine[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  assert.ok(registered.includes('onCwd'), `handlersRef must include onCwd: ${registered.join(', ')}`);

  const destructure = /function TerminalScreen\(\{([\s\S]*?)\}: TerminalScreenProps\) \{/.exec(source);
  assert.notEqual(destructure, null);
  const params = destructure[1]
    .split(',')
    .map((line) => line.replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter(Boolean);
  assert.ok(params.includes('onCwd'), `TerminalScreen must destructure onCwd: ${params.join(', ')}`);
});

test('the menu actions read the live directory', () => {
  /* A `cd` right before the click must be honoured: the render snapshot predates it. */
  assert.match(
    panelSource,
    /await refreshTerminalCwd\(terminal\.id, terminalCwdRef\.current\.get\(terminal\.id\) \?\? terminal\.cwd\)/,
  );
  assert.match(panelSource, /cwd,/);
  assert.match(panelSource, /duplicate: \(\) => void createTerminal\(terminal\.shell, cwd\)/);
  assert.match(panelSource, /openReadme: \(\) => void openTerminalReadme\(cwd\)/);
  assert.match(panelSource, /revealCwd: \(\) => void revealTerminalDirectory\(cwd\)/);
});
