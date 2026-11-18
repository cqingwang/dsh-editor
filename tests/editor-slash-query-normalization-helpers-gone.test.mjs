import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('slash query normalization helpers are gone', () => {
  assert.doesNotMatch(source, /function searchEverywhereContentQuery\(/);
  assert.doesNotMatch(source, /function searchEverywhereCommandQuery\(/);
});

test('/replace no longer collapses All into Actions-only results', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.doesNotMatch(dialog, /const commandMode = commandQuery !== null/);
  assert.doesNotMatch(dialog, /else if \(commandMode\) results = actionMatches/);
  assert.match(dialog, /searchFilters\.files \? fileMatches/);
  assert.match(dialog, /searchFilters\.text \? textResults/);
});

test('background text search uses the literal query from the active tab', () => {
  assert.match(
    source,
    /const searchEverywhereTextQuery = searchEverywhereRawQuery/,
  );
  assert.doesNotMatch(source, /searchEverywhereTextQuery\.startsWith\('\/'\)/);
});
