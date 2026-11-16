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
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const replaceAdvanceIndex = new Function(
  `${extract('findToolReplaceAdvanceIndex')}\nreturn findToolReplaceAdvanceIndex;`,
)();

test('Single Replace advances past the newly inserted matching text', () => {
  const rows = [
    { rowKey: 'text:r675.txt:1:1' },
    { rowKey: 'text:r675.txt:2:1' },
    { rowKey: 'text:r675.txt:3:1' },
  ];
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 0), 1);
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:3:1', 2), 0);
});

test('Single Replace keeps the natural next index when the replaced row disappears', () => {
  const rows = [
    { rowKey: 'text:r675.txt:2:1' },
    { rowKey: 'text:r675.txt:3:1' },
  ];
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 0), 0);
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 9), 1);
  assert.equal(replaceAdvanceIndex([], 'missing', 3), 0);
});

test('Single replacement records the replaced row and applies one advance request', () => {
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(replaceOne, /replaceAdvanceRowKey: match\.rowKey/u);
  assert.match(replaceOne, /replaceAdvanceRevision: \(current\.replaceAdvanceRevision \?\? 0\) \+ 1/u);
  assert.match(source, /findToolReplaceAdvanceIndex\(occurrences, state\.replaceAdvanceRowKey, state\.index\)/u);
});
