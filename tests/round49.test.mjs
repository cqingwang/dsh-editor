import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const searchModelSource = readFileSync(join(root, 'src/client/components/commit/commit-search-model.ts'), 'utf8');
const revisionPickerSource = readFileSync(join(root, 'src/client/components/commit/RevisionPicker.tsx'), 'utf8');
const scoreFor = loadTypeScriptFunction(searchModelSource, 'commitSearchScore');

test('commit search matches hash prefix, subject and author', () => {
  const commit = {
    hash: '9b3a728a1b2c3d4e5f60718293a4b5c6d7e8f901',
    subject: 'feat: draw lanes',
    author: 'Ada Lovelace',
    date: '2026-11-09T23:51:00+08:00',
  };
  /* A typed hash is the most specific thing a user can search by. */
  assert.ok(scoreFor(commit, '9b3a7') > 0);
  assert.ok(scoreFor(commit, 'lanes') > 0);
  assert.ok(scoreFor(commit, 'ada') > 0);
  assert.equal(scoreFor(commit, 'zzz'), -1);
  /* Case-insensitive, like the log filter next to it. */
  assert.ok(scoreFor(commit, 'DRAW') > 0);
  /* An empty query keeps every row (the caller does the slicing). */
  assert.equal(scoreFor(commit, ''), 0);
});

test('the revision picker offers more than a fixed short list', () => {
  /* The old menu read exactly 20 commits and could not be searched. */
  const start = source.indexOf('const compareWithRevision = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const showCommitDiff', start));
  assert.match(block, /op: 'log', limit: 100/);
  /* The search itself lives in the picker, which filters the loaded page. */
  assert.match(revisionPickerSource, /commitSearchScore\(commit, needle\) >= 0/);
  assert.match(revisionPickerSource, /t\('editor\.compareRevisionPlaceholder'\)/);
  assert.match(revisionPickerSource, /onKeyDown=\{\(event\) => \{/);
});

test('update project refreshes the log it just moved', () => {
  const start = source.indexOf('const updateNow = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const commit = React.useCallback(', start));
  /* A pull can add commits; a stale log tab would hide them. */
  assert.match(block, /await loadLog\(\)/);
  assert.match(block, /setHistoryPath\(null\)/);
});
