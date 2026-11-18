import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitLogDetailPane.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8'),
].join('\n');

function commitLog() {
  return source.slice(source.indexOf('function CommitLogDetailPane({'), source.indexOf('export { CommitLogDetailPane };'));
}

test('Commit Log file context menu can reopen the clicked revision diff', () => {
  const log = commitLog();
  assert.match(log, /onFileMenu\?\.\(\{\s+path: file\.path,\s+hash: detail\.hash,\s+localExists,\s+localDirExists,\s+x: event\.clientX,\s+y: event\.clientY,/s);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const fileMenu = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');
  assert.match(workspace, /const buildCommitFileMenu = React\.useCallback\(/);
  assert.match(fileMenu, /id: 'diff'/);
  assert.match(fileMenu, /label: t\('editor\.showDiff'\)/);
  assert.match(fileMenu, /disabled: !revisionAvailable/);
  assert.match(fileMenu, /onShowDiff\(\{ hash: revisionHash, path \}\)/);
  assert.doesNotMatch(workspace, /\[onShowCommitDiff,/);
});

test('Commit Log file menu keeps the existing IDEA single-file actions', () => {
  const menu = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');
  for (const id of ['diff', 'reveal', 'openLocalVersion', 'history', 'copyRelative']) {
    assert.match(menu, new RegExp(`id: '${id}'`));
  }
});
