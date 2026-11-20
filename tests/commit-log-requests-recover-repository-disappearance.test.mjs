import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

function callback(startMarker, endMarker) {
  const start = workspace.indexOf(startMarker);
  const end = workspace.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing callback: ${startMarker}`);
  assert.notEqual(end, -1, `missing callback boundary: ${endMarker}`);
  return workspace.slice(start, end);
}

test('Log, Graph, file history and revision picker share the repository boundary', () => {
  const actions = [
    ['const loadLog = React.useCallback(', 'const loadMoreLog = React.useCallback('],
    ['const loadMoreLog = React.useCallback(', '/**\n   * Load the bounded commit graph'],
    ['const loadGraph = React.useCallback(', '/* A repository can disappear while'],
    ['const showFileHistory = React.useCallback(', 'const changeLogAuthor = React.useCallback('],
    ['const compareWithRevision = React.useCallback(', 'const showCommitDiff = React.useCallback('],
  ];
  for (const [startMarker, endMarker] of actions) {
    const action = callback(startMarker, endMarker);
    assert.match(action, /reportGitFailure\(failure, set(?:Log|Editor)Error\);/u, startMarker);
    assert.doesNotMatch(
      action,
      /set(?:Log|Editor)Error\(failure instanceof Error \? failure\.message : String\(failure\)\)/u,
      startMarker,
    );
  }
});

test('repository-missing failures do not leave raw fatal text in Log channels', () => {
  assert.doesNotMatch(workspace, /setLogError\(failure instanceof Error \? failure\.message : String\(failure\)\)/u);
});
