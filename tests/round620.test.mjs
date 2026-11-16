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

function historyFunctions() {
  return new Function(
    `${extractFunction('normalizeRecentSearchEntry')};`
      + `${extractFunction('rememberSearchHistory')};`
      + `${extractFunction('rememberRecentSearchHistory')};`
      + 'return { normalizeRecentSearchEntry, rememberSearchHistory, rememberRecentSearchHistory };',
  )();
}

test('recent search history preserves literal slash queries', () => {
  const { normalizeRecentSearchEntry, rememberRecentSearchHistory } = historyFunctions();
  assert.equal(normalizeRecentSearchEntry('/replace'), '/replace');
  assert.equal(normalizeRecentSearchEntry('/text Scoped'), '/text Scoped');
  assert.equal(normalizeRecentSearchEntry('/files README'), '/files README');
  assert.equal(normalizeRecentSearchEntry('/te'), '/te');
  assert.equal(normalizeRecentSearchEntry('/'), '/');
  assert.equal(normalizeRecentSearchEntry('  end  '), 'end');
  assert.deepEqual(rememberRecentSearchHistory([
    '/replace',
    'replace',
    '/te',
    '/',
    'end',
    '/text Scoped',
    '/files README',
    '/actions find',
  ], '', 20), ['/replace', 'replace', '/te', '/', 'end', '/text Scoped', '/files README', '/actions find']);
});

test('new searches store the exact literal query', () => {
  const { rememberRecentSearchHistory } = historyFunctions();
  assert.deepEqual(rememberRecentSearchHistory(['old'], '/text Scoped', 20), ['/text Scoped', 'old']);
  assert.deepEqual(rememberRecentSearchHistory(['old'], '/files README', 20), ['/files README', 'old']);
  assert.deepEqual(rememberRecentSearchHistory(['old'], '/actions find', 20), ['/actions find', 'old']);
  assert.deepEqual(rememberRecentSearchHistory(['old'], '/te', 20), ['/te', 'old']);
  assert.deepEqual(rememberRecentSearchHistory(['old'], '/', 20), ['/', 'old']);
});

test('only recent search history uses migration, not Find Usages history', () => {
  assert.match(source, /function readSearchHistory\(root\)[\s\S]*?rememberRecentSearchHistory\(parsed, '', 20\)/);
  assert.match(source, /function writeSearchHistory\(root, history\)[\s\S]*?rememberRecentSearchHistory\(history, '', 20\)/);
  assert.match(source, /function readFindUsagesHistory\(root\)[\s\S]*?rememberSearchHistory\(parsed, '', 20\)/);
  assert.match(source, /const normalizedQuery = normalizeRecentSearchEntry\(query\);/);
  assert.match(source, /const next = rememberSearchHistory\(readSearchHistory\(root\), normalizedQuery, 20\);/);
});
