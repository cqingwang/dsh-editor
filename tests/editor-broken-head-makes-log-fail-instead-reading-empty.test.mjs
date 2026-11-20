import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

import { describeGitError, gitLog } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('a broken HEAD makes the log fail instead of reading as empty', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r47-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 't@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'T']);
  await writeFile(join(dir, 'a.txt'), '1\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'only commit']);
  assert.equal((await gitLog(dir, 10)).length, 1);

  /* Point HEAD at a branch with no commits, the shape a broken clone leaves. */
  await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/nope\n');
  await assert.rejects(() => gitLog(dir, 10), /does not have any commits yet/u);
});

test('git failures surface the sentence git actually wrote', () => {
  const failure = Object.assign(new Error('Command failed: git -C /w log -n60 --skip=0 --pretty=format:…'), {
    stderr: 'warning: refname is ambiguous\nfatal: your current branch \'nope\' does not have any commits yet\n',
  });
  assert.equal(describeGitError(failure), "fatal: your current branch 'nope' does not have any commits yet");
  /* No stderr at all: fall back to the error's own message, never "[object Object]". */
  assert.equal(describeGitError({ stderr: '', message: 'Command failed: git log' }), 'Command failed: git log');
  assert.equal(describeGitError(new Error('unknown branch: x')), 'unknown branch: x');
  assert.equal(describeGitError('boom'), 'boom');
});

test('the log failure banner offers a retry and suppresses the empty state', () => {
  const client = [
    read('src/client/editor-workspace.tsx'),
    read('src/client/components/commit/CommitLogListState.tsx'),
  ].join('\n');
  assert.match(client, /const \[logError, setLogError\] =\s+React\.useState(?:<[^>]+>)?\(null\);/);
  assert.match(client, /t\('editor\.logFailed', \{\s+message: logFailure,\s+\}\)/);
  assert.match(client, /t\('editor\.logRetry'\)/);
  /* "No commits" is a statement about the repository; only say it after a
     successful (empty) answer. */
  assert.match(client, /!graphMode && commitCount === 0 && !loading && logFailure === null/);
  assert.match(client, /logFailure=\{logError\}/);
});

test('the graph clears the previous failure on success', async () => {
  const client = read('src/client/editor-workspace.tsx');
  const errors = [];
  const loadGraph = loadTypeScriptCallback(client, 'loadGraph', {
    git: { isRepo: true },
    beginLogRequest: () => new AbortController(),
    finishLogRequest: () => {},
    callGit: async () => ({
      entries: [],
      branches: [],
      tags: [],
      branchList: [],
      tagList: [],
      head: null,
      branch: null,
      at: null,
    }),
    setLogLoading: () => {},
    setGraph: () => {},
    setLogError: (value) => errors.push(value),
    reportGitFailure: (failure, setError) => {
      setError(failure instanceof Error ? failure.message : String(failure));
    },
  });
  await loadGraph('', '');
  assert.deepEqual(errors, [null]);
});
