import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('retrying a failed Load More resumes paging instead of reloading page zero', () => {
  assert.match(
    workspace,
    /const retryVisibleLog = \(\): void =>\s+commits\.length > 0 && logError !== null && historyPath === null\s+\? void loadMoreLog\(\)\s+: reloadVisibleLog\(\);/u,
  );
  assert.match(workspace, /onLoadLog=\{reloadVisibleLog\}/u);
  assert.match(workspace, /onRetry=\{retryVisibleLog\}/u);
  assert.match(
    log,
    /const node = event\.currentTarget;\s+if \(logFailure !== null\) return;\s+if \(node\.scrollHeight - node\.scrollTop - node\.clientHeight > 48\) return;/u,
  );
  assert.match(
    log,
    /if \(hidden \|\| graphMode \|\| logFailure === null \|\| listedCommitCount === 0\) return;[\s\S]*?node\.scrollTop = Math\.max\(0, node\.scrollHeight - node\.clientHeight\);/u,
  );
});
