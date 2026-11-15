import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitLog() {
  return source.slice(source.indexOf('function CommitLog('), source.indexOf('/** Compact absolute time for the log rows. */'));
}

test('Commit Log file rows are keyboard-reachable for their context menu', () => {
  const log = commitLog();
  assert.match(log, /tabIndex: 0,/);
  assert.match(log, /event\.key !== 'ContextMenu' && !\(event\.shiftKey && event\.key === 'F10'\)/);
  assert.match(log, /onFileMenu\?\.\(\{ path: file\.path, hash: detail\.hash, localExists, localDirExists, x: rect\.left \+ 12, y: rect\.bottom \}\)/);
  assert.match(log, /event\.currentTarget\.focus\?\.\(\)/);
});

test('Commit Log file menu names the working copy action Open Local Version', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  assert.match(menu, /id: 'openLocalVersion'/);
  assert.match(menu, /label: t\('editor\.openLocalVersion'\)/);
  assert.match(menu, /if \(localExists !== false\) void editLocalVersion\(path\)/);
  assert.doesNotMatch(menu, /label: t\('editor\.openInEditor'\)/);
});
