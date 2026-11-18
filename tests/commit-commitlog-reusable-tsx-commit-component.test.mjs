import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitLog is a reusable TSX commit component', async () => {
  const component = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(component, /export interface CommitLogProps/u);
  assert.match(component, /function CommitLogView\(/u);
  assert.match(component, /data-dsh-log-panel=''/u);
  assert.match(component, /<CommitLogFlatRow/u);
  assert.match(component, /<CommitGraph/u);
  assert.match(component, /<CommitLogToolbar/u);
  assert.match(component, /import \{ CommitLogToolbar \} from '\.\/CommitLogToolbar'/u);
  assert.match(component, /const CommitLog = CommitLogView;/u);
  assert.match(component, /export \{ CommitLog \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n    <div\n      style=\{styles\.commitLogBody\}/u);
});

test('build embeds CommitLog and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/find-tool.ts');
  const fixture = await read('tests/fixtures/commit-log.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /CommitLog\.tsx/u);
  assert.match(build, /commitLogModule/u);
  assert.doesNotMatch(legacy, /function CommitLog\(/u);
  assert.match(fixture, /function CommitLog\(/u);
  assert.match(client, /function CommitLogView\(/u);
  assert.doesNotMatch(client, /function CommitLog\(/u);
  assert.match(client, /React\.createElement\(CommitLog/);
});

test('CommitLog fixture keeps a log-only boundary and legacy helper oracle', async () => {
  const fixture = await read('tests/fixtures/commit-log.legacy.js');
  const start = fixture.indexOf('function CommitLog(');
  const boundary = fixture.indexOf('/* COMMIT_LOG_BOUNDARY */');
  const helper = fixture.indexOf('function formatCommitDate(', boundary);

  assert.ok(start >= 0);
  assert.ok(boundary > start);
  assert.ok(helper > boundary);
});
