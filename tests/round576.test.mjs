import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('provider command completion no longer exists', () => {
  assert.doesNotMatch(source, /function searchEverywhereProviderCompletion\(/);
});

test('Search Everywhere uses Tab only for basic tab cycling', () => {
  const input = source.slice(
    source.indexOf("'data-dsh-search-query': ''"),
    source.indexOf('effectiveQuery ===', source.indexOf("'data-dsh-search-query': ''")),
  );
  const cycle = input.indexOf("cycleTab(event.shiftKey ? -1 : 1)");
  assert.ok(cycle >= 0, 'tab cycling hook is missing');
  assert.doesNotMatch(input, /searchEverywhereProviderCompletion/);
  assert.doesNotMatch(input, /providerCompletion/);
});
