import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('recursive expansion loads every descendant directory', async () => {
  const fn = new Function(`async ${extractFunction('expandDirectorySubtrees')}; return expandDirectorySubtrees;`)();
  const listings = {
    a: [
      { path: 'a/b', kind: 'directory' },
      { path: 'a/file.txt', kind: 'file' },
      { path: 'a/empty', kind: 'directory' },
    ],
    'a/b': [{ path: 'a/b/deep', kind: 'directory' }],
    'a/b/deep': [{ path: 'a/b/deep/file.ts', kind: 'file' }],
    'a/empty': [],
  };
  const calls = [];
  const result = await fn(
    ['a'],
    { expanded: new Set(['']), children: {} },
    async (path) => {
      calls.push(path);
      return listings[path] ?? [];
    },
  );
  assert.deepEqual(calls, ['a', 'a/b', 'a/empty', 'a/b/deep']);
  assert.deepEqual([...result.expanded].sort(), ['', 'a', 'a/b', 'a/b/deep', 'a/empty']);
  assert.deepEqual(Object.keys(result.children).sort(), ['a', 'a/b', 'a/b/deep', 'a/empty']);
  assert.equal(result.truncated, false);
});

test('multiple starts share one traversal, ignore duplicates and keep failed paths absent', async () => {
  const fn = new Function(`async ${extractFunction('expandDirectorySubtrees')}; return expandDirectorySubtrees;`)();
  const calls = [];
  const result = await fn(
    ['a', 'a', 'a/b', 'missing'],
    { expanded: new Set(), children: { a: [{ path: 'a/b', kind: 'directory' }] } },
    async (path) => {
      calls.push(path);
      if (path === 'missing') throw new Error('gone');
      return path === 'a/b' ? [] : resultListing(path);
    },
  );
  function resultListing(path) {
    return path === 'a' ? [{ path: 'a/b', kind: 'directory' }] : [];
  }
  assert.deepEqual(calls, ['a/b', 'missing']);
  assert.deepEqual([...result.expanded].sort(), ['a', 'a/b']);
  assert.equal(result.expanded.has('missing'), false);
});

test('recursive expansion stops at the configured safety bound', async () => {
  const fn = new Function(`async ${extractFunction('expandDirectorySubtrees')}; return expandDirectorySubtrees;`)();
  const result = await fn(
    ['d0'],
    { expanded: new Set(), children: {} },
    async (path) => {
      const depth = Number(path.slice(1));
      return depth < 5 ? [{ path: `d${depth + 1}`, kind: 'directory' }] : [];
    },
    2,
  );
  assert.deepEqual([...result.expanded].sort(), ['d0', 'd1']);
  assert.equal(result.visited, 2);
  assert.equal(result.truncated, true);
});

test('Expand Selected follows IDEA and acts on every selected path', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /disabled: !projectCanExpandSelection\(rows, selection\)/);
  const wiring = source.slice(source.indexOf('onExpandSelected:'), source.indexOf('onExpandAll: expandAll,'));
  assert.match(wiring, /void expandSelectedTree\(\)/);
  assert.match(source, /const expandSelectedTree = React\.useCallback\(/);
  assert.match(source, /\[\.\.\.selection\]/);
  assert.match(source, /ancestorsOf\(path\)/);
  assert.match(source, /expandSubtrees\(\[\.\.\.new Set\(starts\)\]\)/);
});

test('Expand All reuses the same recursive traversal', () => {
  const expandAll = source.slice(source.indexOf('const expandAll = React.useCallback('), source.indexOf('/* Clear every expansion state. */'));
  assert.match(expandAll, /expandSubtrees\(/);
  assert.match(expandAll, /entries\.filter\(\(entry\) => entry\.kind === 'directory'\)/);
  assert.doesNotMatch(expandAll, /while \(queue\.length > 0/);
});
