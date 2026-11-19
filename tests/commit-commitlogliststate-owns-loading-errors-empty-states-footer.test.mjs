import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitLogListState owns loading, errors, empty states and footer', async () => {
  const state = await read('src/client/components/commit/CommitLogListState.tsx');

  assert.match(state, /interface CommitLogListStateProps/u);
  assert.match(state, /section: 'status' \| 'footer'/u);
  assert.match(state, /function CommitLogListState\(/u);
  assert.match(state, /section === 'status' && !graphMode && loading && logFailure === null/u);
  assert.match(state, /section === 'status' && logFailure !== null/u);
  assert.match(state, /t\('editor\.logFailed'/u);
  assert.match(state, /t\('editor\.logRetry'\)/u);
  assert.match(state, /aria-disabled=\{loading \? true : undefined\}/u);
  assert.match(state, /if \(!loading\) onRetry\?\.\(\)/u);
  assert.match(state, /loading \? t\('editor\.loading'\) : t\('editor\.logRetry'\)/u);
  assert.match(state, /!loading && commitCount > 0 && visibleCount === 0/u);
  assert.match(state, /commitCount === 0 && !loading && logFailure === null/u);
  assert.match(state, /section === 'footer' && exhausted && visibleCount > 0/u);
  assert.doesNotMatch(state, /React\.createElement/u);
  assert.match(state, /export \{ CommitLogListState \};/u);
});

test('CommitLog uses status and footer list-state sections', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /import \{ CommitLogListState \} from '\.\/CommitLogListState'/u);
  assert.match(log, /<CommitLogListState\s+section='status'[\s\S]*?onRetry=\{retryList\}/u);
  assert.match(log, /<CommitLogListState\s+section='footer'[\s\S]*?exhausted=\{exhausted === true\}/u);
  assert.doesNotMatch(log, /t\('editor\.noMatches'\)/u);
  assert.doesNotMatch(log, /t\('editor\.noCommits'\)/u);
  assert.doesNotMatch(log, /t\('editor\.logEnd'\)/u);
  assert.match(build, /CommitLogListState\.tsx/u);
  assert.match(client, /function CommitLogListState\(/u);
});
