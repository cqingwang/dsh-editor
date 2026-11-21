import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf('\n    }', start);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return source.slice(start, end + '\n    }'.length);
}

function loadReplaceFailureState() {
  return new Function(
    [
      extractSource('replaceGenerationIsCurrent'),
      extractSource('replaceFailureSettlement'),
      extractSource('replaceFailureState'),
      'return replaceFailureState;',
    ].join('\n'),
  )();
}

test('the current query keeps replacement failures and focus', () => {
  const patch = loadReplaceFailureState();
  const state = {
    query: 'end',
    searchGeneration: 4,
    replaceFocusRequest: 2,
    replaceBusy: true,
    errorSource: 'files',
  };
  const next = patch(state, 4, 'failed');
  assert.equal(next.error, 'failed');
  assert.equal(next.errorSource, null);
  assert.equal(next.replaceBusy, false);
  assert.equal(next.replaceFocusRequest, 3);
});

test('a stale replacement failure does not attach to a newer query', () => {
  const patch = loadReplaceFailureState();
  const state = { query: 'Value', searchGeneration: 5, replaceFocusRequest: 2, replaceBusy: true };
  const next = patch(state, 4, 'failed');
  assert.equal(next.error, null);
  assert.equal(next.replaceBusy, false);
  assert.equal(next.replaceFocusRequest, 2);
});

test('both replacement paths use the stale-safe failure state', () => {
  assert.ok((source.match(/replaceFailureState\(current, requestGeneration, message\)/g) ?? []).length >= 2);
  assert.ok(
    (source.match(/const requestGeneration = Math\.max\(0, Number\(findTool\?\.searchGeneration\) \|\| 0\);/g) ?? [])
      .length >= 2,
  );
});

test('Search Everywhere replacement attempts are scoped to their request and query', () => {
  const requestIsCurrent = new Function(
    `${extractSource('replaceAttemptIsCurrent')}\nreturn replaceAttemptIsCurrent;`,
  )();
  assert.equal(requestIsCurrent(7, 'end', 7, 'end'), true);
  assert.equal(requestIsCurrent(7, 'end', 8, 'end'), false);
  assert.equal(requestIsCurrent(7, 'end', 7, 'Value'), false);
});

test('Search Everywhere failures settle through the shared stale-safe focus state', () => {
  const settle = new Function(`${extractSource('replaceFailureSettlement')}\nreturn replaceFailureSettlement;`)();
  const current = { query: 'Value', replaceFocusRequest: 2, replaceBusy: true, errorSource: 'files' };
  const currentFailure = settle(current, true, 'failed');
  assert.equal(currentFailure.error, 'failed');
  assert.equal(currentFailure.errorSource, null);
  assert.equal(currentFailure.replaceBusy, false);
  assert.equal(currentFailure.replaceFocusRequest, 3);
  const staleFailure = settle(current, false, 'old failure');
  assert.equal(staleFailure.error, null);
  assert.equal(staleFailure.errorSource, null);
  assert.equal(staleFailure.replaceBusy, false);
  assert.equal(staleFailure.replaceFocusRequest, 2);

  const replaceInSearch = source.slice(
    source.indexOf('const replaceInFiles = React.useCallback'),
    source.indexOf('const replaceInFindTool = React.useCallback'),
  );
  assert.match(
    replaceInSearch,
    /const request = \{ id: searchTextRequestRef\.current, sessionId: currentSessionId\(\), workspaceId \};/u,
  );
  assert.ok((replaceInSearch.match(/replaceFailureSettlement\(/gu) ?? []).length >= 2);
  assert.match(
    replaceInSearch,
    /replaceAttemptIsCurrent\(request\.id,\s*requestQuery,\s*searchTextRequestRef\.current,\s*current\?\.query\)/u,
  );
});

test('Search Everywhere success does not clear results for a newer query', () => {
  const replaceInSearch = source.slice(
    source.indexOf('const replaceInFiles = React.useCallback'),
    source.indexOf('const replaceInFindTool = React.useCallback'),
  );
  assert.match(
    replaceInSearch,
    /setSearchEverywhere\(\(current\) =>\s+searchEverywhereReplaceSuccessState\(\s+current,\s+replaceAttemptIsCurrent\(/u,
  );
});

test('Find replacement success cannot clear or advance a newer query', () => {
  const generationIsCurrent = new Function(
    `${extractSource('replaceGenerationIsCurrent')}\nreturn replaceGenerationIsCurrent;`,
  )();
  assert.equal(generationIsCurrent({ searchGeneration: 4 }, 4), true);
  assert.equal(generationIsCurrent({ searchGeneration: 5 }, 4), false);

  const replaceAll = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const undoFindReplace = React.useCallback'),
  );
  for (const block of [replaceAll, replaceOne]) {
    assert.match(block, /replaceGenerationIsCurrent\(current, requestGeneration\)/u);
  }
});
