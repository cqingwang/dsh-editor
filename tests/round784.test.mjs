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

const pruneProjectExpandedPaths = new Function(
  `${extract('dirname')}\n${extract('pruneProjectExpandedPaths')}\nreturn pruneProjectExpandedPaths;`,
)();

test('deleted directories and descendants are removed from expansion state', () => {
  const expanded = new Set(['', 'gone', 'gone/nested', 'kept']);
  const state = pruneProjectExpandedPaths({
    expanded,
    rootEntries: [{ path: 'kept', kind: 'directory' }],
    children: {
      gone: [{ path: 'gone/nested', kind: 'directory' }],
      'gone/nested': [],
      kept: [],
    },
  });
  assert.deepEqual([...state], ['', 'kept']);
});

test('a valid expanded child survives while its collapsed parent listing is known', () => {
  const expanded = new Set(['', 'src/deep']);
  const state = pruneProjectExpandedPaths({
    expanded,
    rootEntries: [{ path: 'src', kind: 'directory' }],
    children: {
      src: [{ path: 'src/deep', kind: 'directory' }],
      'src/deep': [],
    },
  });
  assert.equal(state, expanded);
});

test('unknown parent listing is not enough evidence to discard expansion', () => {
  const expanded = new Set(['', 'offline/nested']);
  const state = pruneProjectExpandedPaths({
    expanded,
    rootEntries: [{ path: 'offline', kind: 'directory' }],
    children: {},
  });
  assert.equal(state, expanded);
});
