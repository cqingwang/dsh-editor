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

test('the current query keeps replacement failures and focus', () => {
  const patch = new Function(`${extractSource('replaceFailureState')}\nreturn replaceFailureState;`)();
  const state = { query: 'end', searchGeneration: 4, replaceFocusRequest: 2, replaceBusy: true };
  const next = patch(state, 4, 'failed');
  assert.equal(next.error, 'failed');
  assert.equal(next.replaceBusy, false);
  assert.equal(next.replaceFocusRequest, 3);
});

test('a stale replacement failure does not attach to a newer query', () => {
  const patch = new Function(`${extractSource('replaceFailureState')}\nreturn replaceFailureState;`)();
  const state = { query: 'Value', searchGeneration: 5, replaceFocusRequest: 2, replaceBusy: true };
  const next = patch(state, 4, 'failed');
  assert.equal(next.error, null);
  assert.equal(next.replaceBusy, false);
  assert.equal(next.replaceFocusRequest, 2);
});

test('both replacement paths use the stale-safe failure state', () => {
  assert.ok((source.match(/replaceFailureState\(current, requestGeneration, message\)/g) ?? []).length >= 2);
  assert.ok((source.match(/const requestGeneration = Math\.max\(0, Number\(findTool\?\.searchGeneration\) \|\| 0\);/g) ?? []).length >= 2);
});
