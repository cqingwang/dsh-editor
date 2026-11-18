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

test('provider command matrix has been removed from production', () => {
  assert.doesNotMatch(source, /function searchEverywhereProviderCommand\(/);
  assert.doesNotMatch(source, /function searchEverywhereContentQuery\(/);
});

test('Search Everywhere generates no slash provider command rows', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.doesNotMatch(dialog, /provider:\$\{tab\}/);
  assert.doesNotMatch(dialog, /showProviderCommands/);
  assert.doesNotMatch(dialog, /searchEverywhereProviderCompletion\(state\.query\)/);
  assert.match(dialog, /const effectiveTab = state\.tab;/);
  assert.match(dialog, /const effectiveQuery = query;/);
});

test('search history records the literal query owned by the active tab', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.match(dialog, /onRememberQuery\(effectiveQuery\)/);
  assert.match(dialog, /query: effectiveQuery,/);
});
