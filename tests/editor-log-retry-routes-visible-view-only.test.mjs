import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('flat Log Retry starts only the visible flat request', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const start = workspace.indexOf('const reloadVisibleLog = React.useCallback');
  assert.notEqual(start, -1);
  const end = workspace.indexOf('}, [historyPath, loadLog, showFileHistory]);', start);
  assert.ok(end > start);
  const retryBlock = workspace.slice(start, end);

  assert.match(retryBlock, /void loadLog\(\);/u);
  assert.doesNotMatch(retryBlock, /loadGraph\(/u);
  assert.match(
    workspace,
    /const retryVisibleLog = \(\): void =>\s+commits\.length > 0 && logError !== null && historyPath === null \? void loadMoreLog\(\) : reloadVisibleLog\(\);/u,
  );
  assert.match(workspace, /onRetry=\{retryVisibleLog\}/u);
});

test('Graph Retry remains routed through CommitLog onLoadGraph', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(
    log,
    /const retryList = \(\) => \{\s*if \(graphMode && onLoadGraph !== undefined\) \{[\s\S]*?onLoadGraph\(graph\?\.branch \?\? '', graph\?\.at \?\? ''\);\s*return;\s*\}\s*onRetry\?\.\(\);\s*\};/u,
  );
});
