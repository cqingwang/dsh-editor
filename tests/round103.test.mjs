import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name, extra = '') {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${extra}${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const shouldShowTreeLoading = load('shouldShowTreeLoading');

test('the tree shows the placeholder only before it has any rows', () => {
  /* The 4s poll re-ran the loader, and the placeholder row pushed the whole tree
     down 22px and back: the list visibly jumped on every refresh. */
  assert.equal(shouldShowTreeLoading({ loading: true, rowCount: 0 }), true);
  assert.equal(shouldShowTreeLoading({ loading: true, rowCount: 12 }), false);
  assert.equal(shouldShowTreeLoading({ loading: false, rowCount: 0 }), false);
  assert.equal(shouldShowTreeLoading(null), false);
});

test('the placeholder is no longer keyed off the raw loading flag', () => {
  const start = source.indexOf('shouldShowTreeLoading({ loading, rowCount: visibleRows.length })');
  assert.notEqual(start, -1, 'the placeholder must go through the helper');
  const block = source.slice(start, start + 260);
  assert.match(block, /t\('editor\.loading'\)/);
});

test('a refresh keeps the current rows on screen while it loads', () => {
  /* `loadRoot` must not flip the loading flag off when data already exists. */
  const start = source.indexOf('const loadRoot = React.useCallback(async () => {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 400);
  assert.match(block, /shouldShowTreeLoading\(/);
});

test('a workspace switch shows the placeholder again', () => {
  /* The previous root's rows say nothing about the new one; keeping the silent path
     there would show a stale tree with no hint that a load is in flight. */
  const start = source.indexOf('const loadRoot = React.useCallback(async () => {');
  const block = source.slice(start, start + 600);
  assert.match(block, /treeRootRef\.current/);
  const setter = source.indexOf("treeRootRef.current = value.root ?? '';");
  assert.notEqual(setter, -1, 'the loaded root must be recorded for the next decision');
});

test('rowsRef mirrors the flattened rows for the loader', () => {
  assert.match(source, /const rowsRef = React\.useRef\(\[\]\);/);
  assert.match(source, /rowsRef\.current = rows;/);
});
