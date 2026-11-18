import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

function commitLog() {
  return source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
}

test('Commit Log file context menu can reopen the clicked revision diff', () => {
  const log = commitLog();
  assert.match(log, /onFileMenu\?\.\(\{ path: file\.path, hash: detail\.hash, localExists, localDirExists, x: event\.clientX, y: event\.clientY \}\)/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const buildCommitFileMenu = React\.useCallback\(\s*\(\{ path, hash, localExists, localDirExists, x, y \}\) => \(\{/);
  assert.match(workspace, /id: 'diff'/);
  assert.match(workspace, /label: t\('editor\.showDiff'\)/);
  assert.match(workspace, /disabled: typeof hash !== 'string' \|\| hash === ''/);
  assert.match(workspace, /showCommitDiff\(\{ hash, path \}\)/);
  assert.doesNotMatch(workspace, /\[onShowCommitDiff,/);
});

test('Commit Log file menu keeps the existing IDEA single-file actions', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  for (const id of ['diff', 'reveal', 'openLocalVersion', 'history', 'copyRelative']) {
    assert.match(menu, new RegExp(`id: '${id}'`));
  }
});
