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

test('Commit Log refreshes local file availability while details stay open', () => {
  const log = source.slice(source.indexOf('function CommitLogView('), source.indexOf('const CommitLog = CommitLogView;'));
  assert.match(log, /const localQueryPaths = \[\.\.\.new Set\(detail\.files\.flatMap\(\(file\) => \[file\.path, dirname\(file\.path\)\]\)\)\]/);
  assert.match(log, /const checkLocalFiles = \(\) => \{/);
  assert.match(log, /window\.setInterval\(checkLocalFiles, 3000\)/);
  assert.match(log, /window\.addEventListener\('focus', checkLocalFiles\)/);
  assert.match(log, /window\.clearInterval\(timer\)/);
});

test('Commit Log disables Open in Terminal when the containing directory is gone', () => {
  const log = source.slice(source.indexOf('function CommitLogView('), source.indexOf('const CommitLog = CommitLogView;'));
  const detail = source.slice(source.indexOf('function CommitLogDetailPane({'), source.indexOf('export { CommitLogDetailPane };'));
  assert.match(detail, /const localDirExists = localFileAvailability\.get\(dirname\(file\.path\)\) !== false/);
  assert.match(detail, /localDirExists,/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = source;
  assert.match(workspace, /\{ path, hash, localExists, localDirExists, x, y \}/);
  assert.match(menu, /id: 'openTerminal'[\s\S]*?disabled: localDirExists === false/);
});
