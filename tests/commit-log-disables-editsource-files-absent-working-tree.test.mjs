import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitLogDetailPane.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'lib/client.js'), 'utf8'),
].join('\n');

test('Commit Log disables EditSource for files absent from the working tree', () => {
  const log = source.slice(source.indexOf('function CommitLogView('), source.indexOf('const CommitLog = CommitLogView;'));
  const detail = source.slice(source.indexOf('function CommitLogDetailPane({'), source.indexOf('export { CommitLogDetailPane };'));
  assert.match(
    log,
    /const \[localFileAvailability, setLocalFileAvailability\] = React\.useState<Map<string, boolean>>\(\(\) => new Map\(\)\)/,
  );
  assert.match(log, /const localQueryPaths = \[\.\.\.new Set\(detail\.files\.flatMap/);
  assert.match(log, /op: 'exists',\s+paths: localQueryPaths,/);
  assert.match(detail, /onEditSource\?\.\(file\.path\)/);
  assert.match(detail, /const localExists = localFileAvailability\.get\(file\.path\) !== false;/);
  assert.match(detail, /onFileMenu\?\.\(\{[\s\S]*?path: file\.path,[\s\S]*?hash: detail\.hash,/);
});

test('Commit Log Open Local Version menu reuses the availability state', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = source;
  assert.match(workspace, /\{ path, hash, localExists, localDirExists, x, y \}/);
  assert.match(menu, /id: 'openLocalVersion'[\s\S]*?disabled: localExists === false/);
});
