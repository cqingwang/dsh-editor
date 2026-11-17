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
  assert.fail(`${name} has no closing brace`);
}

const remapProjectExpandedPaths = new Function(
  `${extract('remapPathAfterMove')}\n${extract('remapProjectExpandedPaths')}\nreturn remapProjectExpandedPaths;`,
)();

test('moved directory expansion follows the destination path and descendants', () => {
  const expanded = new Set(['', 'old', 'old/nested', 'other']);
  const next = remapProjectExpandedPaths(expanded, [['old', 'new']]);
  assert.deepEqual([...next], ['', 'new', 'new/nested', 'other']);
});

test('unchanged expansion keeps the same Set', () => {
  const expanded = new Set(['', 'other']);
  assert.equal(remapProjectExpandedPaths(expanded, [['old', 'new']]), expanded);
});

test('rename and move remap expansion before refreshTree', () => {
  const renameStart = source.indexOf('const commitRename = React.useCallback(');
  const rename = source.slice(renameStart, source.indexOf('const selectActivity', renameStart));
  assert.match(rename, /remapProjectExpandedPathsForMoves\(\[\[renameState\.path, next\]\]\)[\s\S]*?await refreshTree\(\)/u);

  const moveStart = source.indexOf('const moveEntry = React.useCallback(');
  const move = source.slice(moveStart, source.indexOf('/* Resolve one conflicted file', moveStart));
  assert.match(move, /remapProjectExpandedPathsForMoves\(entries\)[\s\S]*?await refreshTree\(\)/u);
});
