import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('switching branches refreshes the log the branch just changed', () => {
  const start = source.indexOf('const checkoutBranch = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const createBranch', start));
  /* A checkout rewrites the commit list; a stale Log tab shows another branch's
     history, which is exactly the wrong thing to act on. */
  assert.match(block, /await loadLog\(\)/);
  assert.match(block, /setHistoryPath\(null\)/);
  assert.match(block, /\[loadLog, reloadFile, refreshTree, t\]/);
});

test('creating a branch refreshes the log too', () => {
  const start = source.indexOf('const submitNamePrompt = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const runStash', start));
  /* Branch creation forks at HEAD, so the row set is unchanged — but a file-history
     filter from another branch must not survive the switch. */
  assert.match(block, /setHistoryPath\(null\)/);
  assert.match(block, /await loadLog\(\)/);
});
