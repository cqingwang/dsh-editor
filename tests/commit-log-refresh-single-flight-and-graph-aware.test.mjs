import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the Log toolbar disables Refresh while its request is loading', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(toolbar, /loading: boolean;/u);
  assert.match(toolbar, /disabled\?: boolean;/u);
  assert.match(toolbar, /icon='refresh'[\s\S]*?disabled=\{disabled \|\| loading\}/u);
  assert.match(log, /<CommitLogToolbar[\s\S]*?loading=\{loading\}/u);
});

test('the Log toolbar refreshes the visible Graph instead of the hidden flat list', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(
    log,
    /const refreshLog = \(\) => \{\s*if \(graphMode && onLoadGraph !== undefined\) \{[\s\S]*?onLoadGraph\(graph\?\.branch \?\? '', graph\?\.at \?\? ''\);\s*return;\s*\}\s*onRefresh\(\);\s*\};/u,
  );
  assert.match(log, /onRefresh=\{refreshLog\}/u);
});

test('log and graph requests deduplicate the same key and abort a superseded request', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');

  assert.match(workspace, /const logRequestRef = React\.useRef<\{[\s\S]*?controller: AbortController;[\s\S]*?\} \| null>\(null\);/u);
  assert.match(workspace, /if \(current\?\.key === requestKey\) return null;/u);
  assert.match(workspace, /current\?\.controller\.abort\(\);/u);
  assert.match(workspace, /const controller = beginLogRequest\(`log\\0\$\{logAuthorRef\.current\}`\);/u);
  assert.match(workspace, /const controller = beginLogRequest\(`graph\\0\$\{branchValue\}\\0\$\{atValue\}`\);/u);
  assert.match(workspace, /\{ signal: controller\.signal \}/u);
});
