import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Find history preserves exact leading and trailing whitespace', () => {
  const functions = new Function(
    `${extractFunction('normalizeFindQueryHistoryEntry')};`
      + `${extractFunction('rememberFindQueryHistory')};`
      + 'return { normalizeFindQueryHistoryEntry, rememberFindQueryHistory };',
  )();
  assert.equal(functions.normalizeFindQueryHistoryEntry(' \nend\n '), ' \nend\n ');
  assert.equal(functions.normalizeFindQueryHistoryEntry('\n'), '\n');
  assert.equal(functions.normalizeFindQueryHistoryEntry(''), '');
  assert.deepEqual(functions.rememberFindQueryHistory(['old'], ' \nend\n ', 20), [' \nend\n ', 'old']);
  assert.deepEqual(functions.rememberFindQueryHistory(['old'], '', 20), ['', 'old']);
  assert.deepEqual(functions.rememberFindQueryHistory(['a', 'b', 'c'], 'd', 2), ['d', 'a']);
});

test('Find has a workspace-scoped exact history separate from Search Everywhere', () => {
  assert.match(source, /function findQueryHistoryStorageKey\(root\)/);
  assert.match(source, /dsh-editor\.find\.query\.history:/);
  assert.match(source, /function readFindQueryHistory\(root\)/);
  assert.match(source, /function writeFindQueryHistory\(root, history\)/);
  assert.match(source, /const \[recentFindQueries, setRecentFindQueries\] = React\.useState\(\[\]\)/);
  assert.match(source, /const rememberCurrentFindQuery = React\.useCallback/);
  assert.match(source, /setRecentFindQueries\(next\)/);
  assert.match(source, /setRecentFindQueries\(root === '' \? \[\] : readFindQueryHistory\(root\)\)/);
  assert.match(source, /queryHistory: recentFindQueries/);
});

test('Find paths record exact history while Search Everywhere keeps its own history', () => {
  assert.match(source, /rememberCurrentFindQuery\(findToolQuery\)/);
  const findReplace = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(findReplace, /rememberCurrentFindQuery\(query\)/);
  assert.match(findReplace, /rememberCurrentFindQuery[\s\S]*?t\]/);
  assert.match(replaceOne, /rememberCurrentFindQuery\(query\)/);
  assert.match(replaceOne, /rememberCurrentFindQuery[\s\S]*?t\]/);

  const searchReplace = source.slice(
    source.indexOf('const replaceInFiles = React.useCallback'),
    source.indexOf('const replaceInFindTool = React.useCallback'),
  );
  assert.match(searchReplace, /rememberCurrentSearchQuery\(query\)/);
  assert.doesNotMatch(searchReplace, /rememberCurrentFindQuery/);
});

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
