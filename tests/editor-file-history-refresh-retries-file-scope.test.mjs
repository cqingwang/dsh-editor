import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('visible file history reload repeats the file scope instead of the whole log', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const calls = [];
  const scope = {
    historyPath: 'src/a.ts',
    showFileHistory: (path) => calls.push(`history:${path}`),
    loadLog: () => calls.push('log'),
  };
  const reloadVisibleLog = loadTypeScriptCallback(workspace, 'reloadVisibleLog', scope);

  reloadVisibleLog();
  scope.historyPath = null;
  reloadVisibleLog();

  assert.deepEqual(calls, ['history:src/a.ts', 'log']);
});

test('CommitPanel refresh and retry receive the scope-aware reload function', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');

  assert.match(workspace, /const reloadVisibleLog = React\.useCallback\(\(\): void => \{[\s\S]*?historyPath !== null[\s\S]*?showFileHistory\(historyPath\)[\s\S]*?loadLog\(\)/u);
  assert.match(workspace, /onLoadLog=\{reloadVisibleLog\}/u);
  assert.match(workspace, /onRetry=\{reloadVisibleLog\}/u);
});
