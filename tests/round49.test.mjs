import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Pull one function out of the client bundle by brace balance and evaluate it, so
 * the assertions run the shipping logic instead of matching its text.
 * @param {string} name - function name at four-space indentation.
 * @returns {Function} the evaluated function.
 */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const scoreFor = load('commitSearchScore');

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
  const pickerStart = source.indexOf('function RevisionPicker(');
  assert.notEqual(pickerStart, -1, 'RevisionPicker is missing');
  const picker = source.slice(pickerStart, source.indexOf('function QuickOpen(', pickerStart));
  assert.match(picker, /commitSearchScore\(commit, needle\) >= 0/);
  assert.match(picker, /t\('editor\.compareRevisionPlaceholder'\)/);
  assert.match(picker, /onKeyDown: \(event\) => \{/);
});

test('update project refreshes the log it just moved', () => {
  const start = source.indexOf('const updateNow = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const commit = React.useCallback(', start));
  /* A pull can add commits; a stale log tab would hide them. */
  assert.match(block, /await loadLog\(\)/);
  assert.match(block, /setHistoryPath\(null\)/);
});
