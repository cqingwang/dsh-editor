import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('hitting the shell cap says what to do, not what the host rejected', () => {
  const limitHelper = source.slice(
    source.indexOf('function terminalCreateFailureLimitReached('),
    source.indexOf('function terminalErrorAfterTabClosed('),
  );
  assert.match(limitHelper, /at most \\d\+ terminals/u);
  const start = source.indexOf('const describeCreateFailure = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /t\('editor\.terminalLimit'\)/);
  assert.match(block, /terminalCreateFailureLimitReached\(failure\)/u);
  /* Other failures keep the host's own sentence. */
  assert.match(block, /: message;/);
  /* The create path must route through the helper, or the cap message never shows. */
  const create = source.slice(source.indexOf('const createTerminal = React.useCallback('), source.indexOf('const cycleTerminalColor'));
  assert.match(
    create,
    /setError\(\{\s+message: describeCreateFailure\(failure\),\s+limitReached: terminalCreateFailureLimitReached\(failure\),?\s+\}\)/u,
  );
  /* Round 150 added `awaitMeasured` (spawn at the screen's real width) to the
     dependency list, so the check is on membership rather than exact text. */
  assert.match(
    create,
    /\[awaitMeasured[^\]]*describeCreateFailure[^\]]*startDirectory[^\]]*onStartDirectoryUsed[^\]]*\]/u,
  );
});

test('both dictionaries carry the cap message', () => {
  assert.equal(source.split('terminalLimit:').length - 1, 2);
});
