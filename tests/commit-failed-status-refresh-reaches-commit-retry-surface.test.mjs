import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function workspace() {
  return source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
}

test('a failed status refresh reaches the Commit retry surface', () => {
  const workspaceSource = workspace();
  const start = workspaceSource.indexOf('const loadGit = React.useCallback(');
  const end = workspaceSource.indexOf('/**\n       * Common commit prefixes', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const loadGit = workspaceSource.slice(start, end);
  assert.match(loadGit, /setCommitError\(null\)/);
  assert.match(
    loadGit,
    /catch \(failure\)[\s\S]*?const message = failure instanceof Error \? failure\.message : String\(failure\);[\s\S]*?setCommitError\(message\)/,
  );
});
