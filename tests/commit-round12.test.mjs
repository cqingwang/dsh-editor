import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('commit panel keeps untracked files in their own unversioned group', () => {
  const client = read('lib/client.js');
  assert.match(client, /const unversioned = \[\]/);
  assert.match(client, /if \(change\.status === '\?\?'\) \{\n\s+unversioned\.push\(change\);\n\s+continue;/);
  assert.match(client, /return \{ staged, unstaged, unversioned \}/);
  assert.match(client, /id: 'unversioned'/);
  assert.match(client, /editor\.unversionedGroup/);
  assert.match(client, /editor\.addToGitignore/);
});

test('add to .gitignore is a host operation with an idempotent data path', () => {
  const host = read('lib/index.js');
  assert.match(host, /async function gitIgnore/);
  assert.match(host, /case 'ignore':/);
  assert.match(host, /export \{[^}]*gitCommit, gitDiff, gitIgnore/);
  assert.match(host, /find the repository top level|rev-parse', '--show-toplevel'/);
  assert.match(host, /const separator = existing === ''/);
});

test('commit message history is per workspace and recalled with arrows', () => {
  const client = read('lib/client.js');
  assert.match(client, /dsh-editor\.commitHistory:/);
  assert.match(client, /const rememberMessage = React\.useCallback/);
  assert.match(client, /const recallMessage = React\.useCallback/);
  assert.match(client, /rememberMessage\(commitMessage\)/);
  assert.match(client, /event\.key === 'ArrowUp' \? 1 : -1/);
  assert.match(client, /const atStart = value\.lastIndexOf/);
});

test('commit log can be filtered and its files open in the editor', () => {
  const client = read('lib/client.js');
  assert.match(client, /const \[filter, setFilter\] = React\.useState\(''\)/);
  assert.match(client, /editor\.logFilterPlaceholder/);
  /* Click shows that commit's diff (IDEA); double-click opens the working copy. */
  assert.match(client, /onClick: \(\) => onShowCommitDiff\?\.\(\{ hash: detail\.hash, path: file\.path \}\)/);
  assert.match(client, /onDoubleClick: \(\) => onOpenFile\?\.\(file\.path\)/);
  assert.match(client, /onOpenFile: \(path\) => void openFile\(path\)/);
  assert.match(client, /onOpenFile,/);
});
