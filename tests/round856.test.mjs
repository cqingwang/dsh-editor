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

const pruneManualOrder = new Function(
  `${extract('dirname')}\n${extract('pruneProjectManualOrder')}\nreturn pruneProjectManualOrder;`,
)();

test('deleted files disappear from saved manual order', () => {
  const order = {
    '': ['README.md', 'deleted.txt', 'kept.txt'],
    src: ['src/deleted.js', 'src/kept.js'],
  };
  assert.deepEqual(
    pruneManualOrder({
      order,
      rootEntries: [{ path: 'README.md' }, { path: 'kept.txt' }, { path: 'src' }],
      children: {
        src: [{ path: 'src/kept.js' }],
      },
    }),
    {
      '': ['README.md', 'kept.txt'],
      src: ['src/kept.js'],
    },
  );
});

test('deleted directories drop their own and descendant manual-order keys', () => {
  const order = {
    '': ['gone', 'kept'],
    gone: ['gone/a'],
    'gone/nested': ['gone/nested/b'],
    kept: ['kept/file'],
  };
  assert.deepEqual(
    pruneManualOrder({
      order,
      rootEntries: [{ path: 'kept' }],
      children: {
        gone: [{ path: 'gone/a' }],
        'gone/nested': [{ path: 'gone/nested/b' }],
        kept: [{ path: 'kept/file' }],
      },
    }),
    {
      '': ['kept'],
      kept: ['kept/file'],
    },
  );
});

test('unknown parent listings are not enough evidence to discard ranks', () => {
  const order = {
    '': ['src'],
    'src/offline': ['src/offline/file.js'],
  };
  assert.equal(
    pruneManualOrder({
      order,
      rootEntries: [{ path: 'src' }],
      children: {},
    }),
    order,
  );
});

test('workspace prunes manual order with the same listing evidence as expansion', () => {
  assert.match(
    source,
    /setManualOrder\(\(current\) => \{[\s\S]*?pruneProjectManualOrder\(\{[\s\S]*?rootEntries: entries,[\s\S]*?children,[\s\S]*?writeProjectManualOrder\(rootRef\.current, next\)/u,
  );
});
