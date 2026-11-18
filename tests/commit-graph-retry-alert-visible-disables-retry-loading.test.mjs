import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Graph retry keeps the alert visible and disables Retry while loading', async () => {
  const state = await read('src/client/components/commit/CommitLogListState.tsx');

  assert.match(state, /logFailure !== null/u);
  assert.doesNotMatch(state, /logFailure !== null && !loading/u);
  assert.match(state, /aria-busy=\{loading \? true : undefined\}/u);
  assert.match(state, /aria-disabled=\{loading \? true : undefined\}/u);
  assert.match(state, /if \(!loading\) onRetry\?\.\(\)/u);
  assert.match(state, /loading \? t\('editor\.loading'\) : t\('editor\.logRetry'\)/u);
});

test('Graph retry success restores keyboard ownership to the log list', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(log, /const logFailedRef = React\.useRef\(logFailure !== null\)/u);
  assert.match(
    log,
    /const recovered = logFailedRef\.current && !failed;[\s\S]*?logFailedRef\.current = failed;[\s\S]*?if \(recovered\)[\s\S]*?listRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/u,
  );
});

test('Graph mode retries only the graph request, not the flat log', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(
    log,
    /const retryList = \(\) => \{[\s\S]*?if \(graphMode && onLoadGraph !== undefined\) \{[\s\S]*?onLoadGraph\(graph\?\.branch \?\? '', graph\?\.at \?\? ''\);[\s\S]*?onRetry\?\.\(\);/u,
  );
  assert.match(log, /onRetry=\{retryList\}/u);
});

test('Retry recovery implementation is included in the built client', async () => {
  const client = await read('lib/client.js');

  assert.match(client, /logFailedRef/u);
  assert.match(client, /aria-busy/u);
  assert.match(client, /aria-disabled/u);
  assert.match(client, /dsh-editor-log-retry/u);
});
