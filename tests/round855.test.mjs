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

const remapManualOrder = new Function(
  `${extract('dirname')}\n${extract('remapPathAfterMove')}\n${extract('remapProjectManualOrder')}\nreturn remapProjectManualOrder;`,
)();

test('renaming a file keeps its manual-order slot', () => {
  const order = { '': ['a.txt', 'b.txt', 'c.txt'] };
  assert.deepEqual(remapManualOrder(order, [['b.txt', 'renamed.txt']]), {
    '': ['a.txt', 'renamed.txt', 'c.txt'],
  });
});

test('moving a file removes its old rank and appends it to the destination', () => {
  const order = {
    '': ['docs', 'src'],
    docs: ['docs/a.md', 'docs/b.md'],
    src: ['src/app.js'],
  };
  assert.deepEqual(remapManualOrder(order, [['docs/b.md', 'src/b.md']]), {
    '': ['docs', 'src'],
    docs: ['docs/a.md'],
    src: ['src/app.js', 'src/b.md'],
  });
});

test('moving a directory migrates descendant ranks and destination ownership', () => {
  const order = {
    '': ['a', 'b'],
    a: ['a/one', 'a/two'],
    'a/nested': ['a/nested/file'],
    b: ['b/keep'],
  };
  assert.deepEqual(remapManualOrder(order, [['a', 'b/a']]), {
    '': ['b'],
    b: ['b/keep', 'b/a'],
    'b/a': ['b/a/one', 'b/a/two'],
    'b/a/nested': ['b/a/nested/file'],
  });
});

test('unrelated manual order stays identity-stable', () => {
  const order = { '': ['a', 'b'] };
  assert.equal(remapManualOrder(order, [['x', 'y/x']]), order);
});

test('rename and move remap manual order before refreshTree', () => {
  const renameStart = source.indexOf('const commitRename = React.useCallback(');
  const rename = source.slice(renameStart, source.indexOf('const selectActivity', renameStart));
  assert.match(
    rename,
    /remapProjectManualOrderForMoves\(\[\[renameState\.path, next\]\]\)[\s\S]*?await refreshTree\(\)/u,
  );

  const moveStart = source.indexOf('const moveEntry = React.useCallback(');
  const move = source.slice(moveStart, source.indexOf('/* Resolve one conflicted file', moveStart));
  assert.match(move, /remapProjectManualOrderForMoves\(entries\)[\s\S]*?await refreshTree\(\)/u);
});
