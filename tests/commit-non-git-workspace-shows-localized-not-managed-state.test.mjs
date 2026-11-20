import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/commit/CommitPanel.tsx', root), 'utf8');
const log = await readFile(new URL('src/client/components/commit/CommitLog.tsx', root), 'utf8');
const logToolbar = await readFile(new URL('src/client/components/commit/CommitLogToolbar.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');
const workspace = await readFile(new URL('src/client/editor-workspace.tsx', root), 'utf8');
const commit = await readFile(new URL('src/client/commit.ts', root), 'utf8');
const reporter = await readFile(
  new URL('src/client/components/commit/use-git-action-failure-reporter.ts', root),
  'utf8',
);
const isGitRepositoryMissingMessage = loadTypeScriptFunction(commit, 'isGitRepositoryMissingMessage');

test('Commit treats a non-git workspace as a normal state', () => {
  assert.match(workspace, /isRepo\?: boolean/u);
  assert.match(panel, /isRepo\?: boolean/u);
  assert.match(panel, /const gitNotManaged = git\?\.isRepo === false;/u);
  assert.match(panel, /gitNotManaged \? <div style=\{styles\.commitNotice\}>\{t\('editor\.gitNotManaged'\)\}<\/div>/u);
  assert.match(locales, /gitNotManaged: '当前不受git管理'/u);
  assert.match(locales, /gitNotManaged: 'This workspace is not managed by Git'/u);
  assert.equal(
    isGitRepositoryMissingMessage(
      'fatal: not a git repository (or any of the parent directories): .git',
    ),
    true,
  );
  assert.equal(isGitRepositoryMissingMessage('fatal: ambiguous argument HEAD'), false);
  assert.match(workspace, /if \(isGitRepositoryMissingMessage\(message\)\)[\s\S]*?reportGitFailure\(failure\)/u);
  assert.match(reporter, /isGitRepositoryMissingMessage\(message\)[\s\S]*?isRepo: false[\s\S]*?setCommitError\(null\)/u);
});

test('Git-only Commit actions are inert without a repository', () => {
  assert.match(workspace, /const loadLog = React\.useCallback\(async \(\) => \{\s+if \(git\?\.isRepo === false\)/u);
  assert.match(workspace, /const loadMoreLog = React\.useCallback\(async \(\) => \{\s+if \(git\?\.isRepo === false\) return;/u);
  assert.match(workspace, /async \(branch\?: string, at\?: string\) => \{[\s\S]*?if \(git\?\.isRepo === false\)/u);
  assert.match(workspace, /async \(path: string\) => \{[\s\S]*?if \(git\?\.isRepo === false\)/u);
  assert.match(workspace, /next === 'log' &&\s+git\?\.isRepo !== false/u);
  assert.equal(
    (panel.match(/disabled=\{busy \|\| gitNotManaged \|\| selectedPaths\.size === 0 \|\| message\.trim\(\) === ''\}/gu) ?? [])
      .length,
    2,
  );
  assert.match(panel, /disabled=\{busy \|\| gitNotManaged \|\| pushing\}/u);
  assert.match(panel, /<CommitLog\s+hidden=\{mode !== 'log'\}\s+disabled=\{gitNotManaged\}/u);
  assert.match(panel, /checked=\{amend\}\s+disabled=\{busy \|\| gitNotManaged\}/u);
  assert.match(workspace, /if \(next && \(git\?\.isRepo === false \|\| git\?\.lastCommit === null \|\| git\?\.lastCommit === undefined\)\) return;/u);
  assert.match(log, /disabled\?: boolean/u);
  assert.match(logToolbar, /disabled\?: boolean/u);
  assert.match(logToolbar, /label=\{t\('editor\.logGraph'\)\}[\s\S]*?disabled=\{disabled\}/u);
  assert.match(logToolbar, /disabled=\{disabled \|\| loading\}/u);
});

test('keyboard commit and stale Git-owned state stay closed without a repository', () => {
  assert.match(
    panel,
    /if \(!busy && !gitNotManaged && selectedPaths\.size > 0 && message\.trim\(\) !== ''\) onCommit\(false\);/u,
  );
  assert.match(
    workspace,
    /const commit = React\.useCallback\(\s+async \(push: boolean\) => \{\s+if \(gitRef\.current\?\.isRepo === false\) return;/u,
  );
  assert.match(
    workspace,
    /if \(git\?\.isRepo !== false\) return;[\s\S]*?setCommitNotice\(null\);[\s\S]*?setIdentityMissing\(false\);[\s\S]*?setPushError\(null\);[\s\S]*?setAmend\(false\);[\s\S]*?setCommits\(\[\]\);[\s\S]*?setLogDetail\(null\);[\s\S]*?setLogError\(null\);[\s\S]*?setLogExhausted\(false\);[\s\S]*?setGraph\(null\);/u,
  );
});
