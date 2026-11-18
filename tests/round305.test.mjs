import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('Commit Log refreshes local file availability while details stay open', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /const localQueryPaths = \[\.\.\.new Set\(detail\.files\.flatMap\(\(file\) => \[file\.path, dirname\(file\.path\)\]\)\)\]/);
  assert.match(log, /const checkLocalFiles = \(\) => \{/);
  assert.match(log, /window\.setInterval\(checkLocalFiles, 3000\)/);
  assert.match(log, /window\.addEventListener\('focus', checkLocalFiles\)/);
  assert.match(log, /window\.clearInterval\(timer\)/);
});

test('Commit Log disables Open in Terminal when the containing directory is gone', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /const localDirExists = localFileAvailability\.get\(dirname\(file\.path\)\) !== false/);
  assert.match(log, /localDirExists, x:/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback(', workspace.indexOf('const buildCommitFileMenu = React.useCallback(')),
  );
  assert.match(menu, /\{ path, hash, localExists, localDirExists, x, y \}/);
  assert.match(menu, /id: 'openTerminal'[\s\S]*?disabled: localDirExists === false/);
});
