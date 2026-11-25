import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const screenSource = await readFile(
  new URL('../src/client/components/terminal/TerminalScreen.tsx', import.meta.url),
  'utf8',
);

function loadSnapshotMetadata() {
  const cwdFromOsc7 = transpileTypeScriptFunction(terminalSource, 'cwdFromOsc7');
  const terminalSnapshotMetadata = transpileTypeScriptFunction(terminalSource, 'terminalSnapshotMetadata');
  return new Function(`${cwdFromOsc7}\n${terminalSnapshotMetadata}\nreturn terminalSnapshotMetadata;`)();
}

test('snapshot metadata keeps only the final OSC title and cwd', () => {
  const terminalSnapshotMetadata = loadSnapshotMetadata();
  const snapshot = [
    '\u001b]7;file://host/private/tmp/demo\u0007',
    '\u001b]0;old title\u0007',
    'prompt\r\n',
    '\u001b]7;file://host/private/tmp/demo/src\u001b\\',
    '\u001b]2;chan@host:/private/tmp/demo/src\u0007',
  ].join('');

  assert.deepEqual(terminalSnapshotMetadata(snapshot), {
    title: 'chan@host:/private/tmp/demo/src',
    cwd: '/private/tmp/demo/src',
  });
});

test('snapshot metadata ignores malformed OSC payloads instead of inventing state', () => {
  const terminalSnapshotMetadata = loadSnapshotMetadata();

  assert.deepEqual(terminalSnapshotMetadata('\u001b]7;http://example.com/x\u0007\u001b]2;   \u0007'), {});
  assert.deepEqual(terminalSnapshotMetadata('plain terminal output'), {});
  assert.deepEqual(terminalSnapshotMetadata(null), {});
});

test('TerminalScreen suppresses stale OSC callbacks while replaying a snapshot', () => {
  assert.match(screenSource, /terminalSnapshotMetadata/);
  assert.match(screenSource, /suppressMetadataRef\.current = true/);
  assert.match(screenSource, /emulator\.write\(event\.data, finishReplay\)/);
  assert.match(screenSource, /replayQueueRef\.current\.push\(event\.data\)/);
  assert.match(screenSource, /handlersRef\.current\.onCwd\?\.\(metadata\.cwd\)/);
});
