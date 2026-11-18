import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('Commit Log file rows use IDEA EditSource F4 and focus the editor', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /onEditSource,/);
  assert.match(log, /event\.key === 'F4'[\s\S]*?if \(!localExists\) return;[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onEditSource\?\.\(file\.path\);/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const editLocalVersion = React\.useCallback\(\(path\) => \{/);
  assert.match(workspace, /if \(opened\) focusEditorOnNextFrame\(editorRef\);/);
  assert.match(workspace, /onEditSource: editLocalVersion/);
});

test('Commit Log file menu advertises and reuses the same F4 path', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  assert.match(menu, /id: 'openLocalVersion'[\s\S]*?shortcut: 'F4'[\s\S]*?if \(localExists !== false\) void editLocalVersion\(path\)/);
  assert.match(menu, /\[showCommitDiff, editLocalVersion, openInTerminal, openRepositoryVersion, revealPath, showFileHistory, root, t\]/);
});
