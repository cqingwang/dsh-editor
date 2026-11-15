import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Commit Log disables EditSource for files absent from the working tree', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('function formatCommitDate('));
  assert.match(log, /const \[localFileAvailability, setLocalFileAvailability\] = React\.useState\(\(\) => new Map\(\)\)/);
  assert.match(log, /const localQueryPaths = \[\.\.\.new Set\(detail\.files\.flatMap/);
  assert.match(log, /callFs\(\{ op: 'exists', paths: localQueryPaths \}\)/);
  assert.match(log, /onEditSource\?\.\(file\.path\)/);
  assert.match(log, /localFileAvailability\.get\(file\.path\) !== false/);
  assert.match(log, /const localExists = localFileAvailability\.get\(file\.path\) !== false;/);
  assert.match(log, /onFileMenu\?\.\(\{ path: file\.path, hash: detail\.hash, localExists, localDirExists, x:/);
});

test('Commit Log Open Local Version menu reuses the availability state', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  assert.match(menu, /\{ path, hash, localExists, localDirExists, x, y \}/);
  assert.match(menu, /id: 'openLocalVersion'[\s\S]*?disabled: localExists === false/);
});
