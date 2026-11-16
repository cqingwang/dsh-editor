import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('the obsolete slash command parser is removed', () => {
  assert.doesNotMatch(source, /function searchEverywhereCommandQuery\(/);
  assert.doesNotMatch(source, /function searchEverywhereProviderCommand\(/);
});

test('recent search history is bounded, unique and newest first', () => {
  const remember = extract('rememberSearchHistory');
  assert.deepEqual(remember(['old'], 'Needle'), ['Needle', 'old']);
  assert.deepEqual(remember(['Needle', 'old'], 'Needle'), ['Needle', 'old']);
  assert.deepEqual(remember([], '  '), []);
  const many = Array.from({ length: 25 }, (_, index) => `q${index}`);
  assert.equal(remember(many, 'latest', 20).length, 20);
  assert.equal(remember(many, 'latest', 20)[0], 'latest');
});

test('slash content stays literal under the active tab', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function QuickOpen('));
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.match(dialog, /rankSearchActions\(actions, effectiveQuery, recentCommands, \{/);
  assert.match(source, /const searchEverywhereTextQuery = searchEverywhereRawQuery/);
  assert.doesNotMatch(source, /searchEverywhereTextQuery\.startsWith\('\/'\)/);
});

test('empty Search Everywhere exposes recent searches and records successful queries', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function QuickOpen('));
  assert.match(dialog, /recentSearches/);
  assert.match(dialog, /historyResults/);
  assert.match(dialog, /onRememberQuery\(effectiveQuery\)/);
  assert.match(source, /dsh-editor\.search\.history/);
});
