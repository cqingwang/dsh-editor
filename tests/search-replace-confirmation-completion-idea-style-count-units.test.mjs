import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  assert.notEqual(index, -1, `${name} should have a body`);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const searchReplaceCountParams = new Function(
  `${extract('searchReplaceCountParams')}\nreturn searchReplaceCountParams;`,
)();

test('Replace confirmation and completion use IDEA-style count units', () => {
  const messages = {
    'editor.searchReplaceMatchOne': 'occurrence',
    'editor.searchReplaceMatchMany': 'occurrences',
    'editor.searchReplaceFileOne': 'file',
    'editor.searchReplaceFileMany': 'files',
  };
  const t = (key) => messages[key] ?? key;
  assert.deepEqual(searchReplaceCountParams(t, 1, 1), {
    matches: 1,
    files: 1,
    matchUnit: 'occurrence',
    fileUnit: 'file',
  });
  assert.deepEqual(searchReplaceCountParams(t, 4, 2), {
    matches: 4,
    files: 2,
    matchUnit: 'occurrences',
    fileUnit: 'files',
  });
});

test('Every workspace replacement path passes the localized count units', () => {
  assert.match(
    source,
    /searchReplaceConfirm: 'Replace \{matches\} \{matchUnit\} of "\{query\}" across \{files\} \{fileUnit\} with "\{replacement\}"\?'/u,
  );
  assert.match(source, /searchReplaceDone: 'Replaced \{matches\} \{matchUnit\} in \{files\} \{fileUnit\}'/u);
  assert.match(source, /searchReplaceCountParams\(t, matches, files\)/u);
  assert.match(source, /searchReplaceCountParams\(t, replacedCount, changed\.length\)/u);
  assert.match(source, /searchReplaceCountParams\(t, replacedCount, changed\.length\)/u);
});
