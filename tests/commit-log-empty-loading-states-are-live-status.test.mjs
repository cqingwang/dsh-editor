import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const state = await readFile(
  new URL('../src/client/components/commit/CommitLogListState.tsx', import.meta.url),
  'utf8',
);

test('Commit Log loading, no-match and empty states are polite atomic status regions', () => {
  assert.equal((state.match(/role='status'/gu) ?? []).length, 3);
  assert.equal((state.match(/aria-live='polite'/gu) ?? []).length, 3);
  assert.equal((state.match(/aria-atomic='true'/gu) ?? []).length, 3);
  assert.match(
    state,
    /loading && logFailure === null \? \(\s*<div[\s\S]*?role='status'[\s\S]*?aria-busy=\{loading \? true : undefined\}[\s\S]*?\{t\('editor\.loading'\)\}/u,
  );
});

test('the error banner remains an alert with its existing retry guard', () => {
  assert.match(state, /role='alert'/u);
  assert.match(state, /aria-disabled=\{loading \? true : undefined\}/u);
  assert.match(state, /if \(!loading\) onRetry\?\.\(\)/u);
});
