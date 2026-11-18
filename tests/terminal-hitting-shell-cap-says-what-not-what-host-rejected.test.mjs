import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('hitting the shell cap says what to do, not what the host rejected', () => {
  const start = source.indexOf('const describeCreateFailure = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /at most \\d\+ terminals/u);
  assert.match(block, /t\('editor\.terminalLimit'\)/);
  /* Other failures keep the host's own sentence. */
  assert.match(block, /: message;/);
  /* The create path must route through the helper, or the cap message never shows. */
  const create = source.slice(source.indexOf('const createTerminal = React.useCallback('), source.indexOf('const cycleTerminalColor'));
  assert.match(create, /setError\(describeCreateFailure\(failure\)\)/);
  /* Round 150 added `awaitMeasured` (spawn at the screen's real width) to the
     dependency list, so the check is on membership rather than exact text. */
  assert.match(create, /awaitMeasured, describeCreateFailure, startDirectory, onStartDirectoryUsed/);
});

test('both dictionaries carry the cap message', () => {
  assert.equal(source.split('terminalLimit:').length - 1, 2);
});
