import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-view-model.ts');
const { commitLogFilterCommits } = loadTypeScriptModule(source, ['commitLogFilterCommits']);
const commits = [
  { hash: 'abcdef123', subject: 'Fix parser', author: 'Alice' },
  { hash: '123456abc', subject: 'Update docs', author: 'Bob' },
];

test('CommitLog filter preserves the same array for a blank query', () => {
  assert.equal(commitLogFilterCommits(commits, ''), commits);
  assert.equal(commitLogFilterCommits(commits, '   '), commits);
});

test('CommitLog filter matches subject, author and hash case-insensitively', () => {
  assert.deepEqual(commitLogFilterCommits(commits, 'PARSER'), [commits[0]]);
  assert.deepEqual(commitLogFilterCommits(commits, 'alice'), [commits[0]]);
  assert.deepEqual(commitLogFilterCommits(commits, '123456'), [commits[1]]);
  assert.deepEqual(commitLogFilterCommits(commits, 'missing'), []);
});

test('CommitLog uses the extracted filter view model', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /import \{ commitLogFilterCommits \} from '\.\/commit-log-view-model'/u);
  assert.match(log, /const visible = commitLogFilterCommits\(commits, filter\)/u);
  assert.doesNotMatch(log, /const needle = filter\.trim\(\)\.toLowerCase\(\)/u);
  assert.match(build, /commit-log-view-model\.ts/u);
  assert.match(client, /function commitLogFilterCommits\(/u);
});
