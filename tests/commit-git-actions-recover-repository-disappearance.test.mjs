import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const reporter = readFileSync(join(root, 'src/client/components/commit/use-git-action-failure-reporter.ts'), 'utf8');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');

function callback(startMarker, endMarker) {
  const start = workspace.indexOf(startMarker);
  const end = workspace.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing callback: ${startMarker}`);
  assert.notEqual(end, -1, `missing callback boundary: ${endMarker}`);
  return workspace.slice(start, end);
}

test('Git actions share one repository-disappearance failure boundary', () => {
  assert.match(reporter, /isGitRepositoryMissingMessage\(message\)/u);
  assert.match(reporter, /setGit\(\{ root: '', isRepo: false, branch: '', prefix: '', changes: \[\] \}\)/u);
  assert.match(reporter, /setCommitSelection\(new Set\(\)\)/u);
  assert.match(reporter, /setCommitError\(null\)/u);
  assert.match(
    workspace,
    /const reportGitFailure = useGitActionFailureReporter\(\{ setGit, setCommitSelection, setCommitError \}\);/u,
  );

  const actions = [
    ['const applyPatchText = React.useCallback(', 'const applyPatchFile = React.useCallback('],
    ['const runStash = React.useCallback(', 'const runShelve = React.useCallback('],
    ['const runShelve = React.useCallback(', '/* Open IDEA'],
    ['const openStashMenu = React.useCallback(', '/* Open IDEA'],
    ['const openShelveMenu = React.useCallback(', '/* Batch delete for the Project tool window'],
    ['const fetchNow = React.useCallback(', 'const updateNow = React.useCallback('],
    ['const updateNow = React.useCallback(', 'Fetch, Update, Stash, Shelve and Group by are low-frequency commands.'],
  ];

  for (const [startMarker, endMarker] of actions) {
    const action = callback(startMarker, endMarker);
    assert.match(action, /catch \(failure\) \{[\s\S]*?reportGitFailure\(failure\);/u, startMarker);
    assert.doesNotMatch(
      action,
      /catch \(failure\) \{[\s\S]*?setCommitError\(failure instanceof Error \? failure\.message : String\(failure\)\);/u,
      startMarker,
    );
  }
});

test('the browser bundle includes the extracted Git failure reporter', () => {
  assert.match(client, /components\/commit\/use-git-action-failure-reporter\.ts/u);
  assert.match(client, /function useGitActionFailureReporter\(/u);
});

test('remaining Commit actions use the shared repository boundary and retain their error owner', () => {
  assert.match(reporter, /setError: \(message: string \| null\) => void = setCommitError/u);
  assert.match(workspace, /reportGitFailure\(failure, setPushError\)/u);
  assert.doesNotMatch(workspace, /setCommitError\(failure instanceof Error \? failure\.message : String\(failure\)\)/u);
  assert.doesNotMatch(workspace, /setPushError\(failure instanceof Error \? failure\.message : String\(failure\)\)/u);
  assert.match(
    workspace,
    /const commit = React\.useCallback\([\s\S]*?catch \(failure\) \{[\s\S]*?reportGitFailure\(failure\);[\s\S]*?finally \{[\s\S]*?endCommitOperation\(\);/u,
  );
});
