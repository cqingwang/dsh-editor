import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('switching back to Commit Log does not discard already loaded pages', () => {
  const start = workspace.indexOf('onMode={(next) => {');
  const end = workspace.indexOf('commits={commits}', start);
  assert.ok(start >= 0 && end > start, 'CommitPanel onMode handler should exist');
  const handler = workspace.slice(start, end);
  assert.doesNotMatch(handler, /if \(next === 'log'\) void loadLog\(\);/u);
  assert.match(
    handler,
    /if \(next === 'log' && commits\.length === 0 && !logExhausted && !logLoading && !logError\)\s+void loadLog\(\);/u,
  );
});
