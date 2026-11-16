import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Commit Log file menu copies a shell-ready absolute path', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  assert.match(menu, /id: 'copyAbsolute'/);
  assert.match(menu, /label: t\('editor\.copyAbsolutePath'\)/);
  assert.match(menu, /shellQuote\(root === '' \? path : `\$\{root\}\/\$\{path\}`\)/);
  assert.match(workspace, /\[showCommitDiff, editLocalVersion, openInTerminal, openRepositoryVersion, revealPath, showFileHistory, root, t\]/);
});
