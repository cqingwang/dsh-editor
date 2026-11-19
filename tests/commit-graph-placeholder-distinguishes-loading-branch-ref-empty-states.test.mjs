import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, flattenDictionary, interpolateMessage, zh } from './locale-source.mjs';
import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-graph-state-model.ts');
const { commitGraphPlaceholder } = loadTypeScriptModule(source, ['commitGraphPlaceholder']);

test('Graph placeholder distinguishes loading, branch, ref and empty states', () => {
  assert.deepEqual(commitGraphPlaceholder(null), {
    kind: 'loading',
    messageKey: 'editor.loading',
  });
  assert.deepEqual(commitGraphPlaceholder(undefined), {
    kind: 'loading',
    messageKey: 'editor.loading',
  });
  assert.deepEqual(commitGraphPlaceholder({ entries: [], branch: 'feature' }), {
    kind: 'branch-empty',
    messageKey: 'editor.graphNoCommitsOnBranch',
  });
  assert.deepEqual(commitGraphPlaceholder({ entries: [], at: 'abc1234' }), {
    kind: 'ref-empty',
    messageKey: 'editor.graphNoCommitsOnRef',
  });
  assert.deepEqual(commitGraphPlaceholder({ entries: [] }), {
    kind: 'empty',
    messageKey: 'editor.noCommits',
  });
  assert.equal(commitGraphPlaceholder({ entries: [], branch: 'main' }, 'git failed'), null);
  assert.equal(commitGraphPlaceholder({ entries: [{ hash: 'a' }] }), null);
});

test('Graph graph states are polite atomic status regions', async () => {
  const graph = await read('src/client/components/commit/CommitGraph.tsx');

  assert.match(graph, /commitGraphPlaceholder\(graph, error\)/u);
  assert.match(graph, /role='status'/u);
  assert.match(graph, /aria-live='polite'/u);
  assert.match(graph, /aria-atomic='true'/u);
  assert.match(graph, /aria-busy=\{placeholder\.kind === 'loading' \? true : undefined\}/u);
  assert.match(graph, /data-dsh-graph-state=\{placeholder\.kind\}/u);
  assert.match(graph, /if \(graph == null\) return null;/u);
  assert.match(graph, /if \(error !== null && error !== '' && sourceEntries\.length === 0\) return null;/u);
});

test('Graph empty and error messages are complete in both dictionaries', () => {
  const zhKeys = flattenDictionary(zh);
  const enKeys = flattenDictionary(en);
  for (const key of [
    'editor.loading',
    'editor.graphNoCommitsOnBranch',
    'editor.graphNoCommitsOnRef',
    'editor.noCommits',
  ]) {
    assert.equal(typeof zhKeys[key], 'string');
    assert.equal(typeof enKeys[key], 'string');
    assert.notEqual(zhKeys[key], '');
    assert.notEqual(enKeys[key], '');
  }
  assert.equal(interpolateMessage(zhKeys['editor.logFailed'], { message: 'boom' }), '读取提交历史失败：boom');
  assert.equal(
    interpolateMessage(enKeys['editor.logFailed'], { message: 'boom' }),
    'Could not read the commit history: boom',
  );
});

test('Graph error state remains an alert with retry', async () => {
  const state = await read('src/client/components/commit/CommitLogListState.tsx');

  assert.match(state, /role='alert'/u);
  assert.match(state, /t\('editor\.logFailed'/u);
  assert.match(state, /t\('editor\.logRetry'\)/u);
});

test('CommitLog suppresses Graph empty placeholders while an error is visible', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');

  assert.match(log, /<CommitGraph[\s\S]*?error=\{logFailure\}/u);
});
