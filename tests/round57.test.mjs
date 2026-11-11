import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping function by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** A tiny change tree: src/{a.ts, nested/{b.ts}} plus top.txt. */
function fixtureTree() {
  const root = { name: '', path: '', directories: new Map(), files: [{ path: 'top.txt' }] };
  const nested = { name: 'nested', path: 'src/nested', directories: new Map(), files: [{ path: 'src/nested/b.ts' }] };
  const src = { name: 'src', path: 'src', directories: new Map([['nested', nested]]), files: [{ path: 'src/a.ts' }] };
  root.directories.set('src', src);
  return root;
}

const collapseKeysOf = load('collapseKeysOf');

test('alt-click expands the whole subtree, not just one level', () => {
  const keys = collapseKeysOf(fixtureTree(), 'unstaged', 'src');
  assert.deepEqual(keys, ['unstaged:src', 'unstaged:src/nested']);
});

test('alt-click on a leaf directory returns only its own key', () => {
  assert.deepEqual(collapseKeysOf(fixtureTree(), 'staged', 'src/nested'), ['staged:src/nested']);
  /* An unknown path yields nothing, so the caller can skip the update. */
  assert.deepEqual(collapseKeysOf(fixtureTree(), 'staged', 'nope'), []);
});

test('a plain click still toggles exactly one node', () => {
  const start = source.indexOf("if (row.kind === 'directory') {");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1400);
  /* Alt is the modifier; a plain click keeps IDEA's single-level behaviour. */
  assert.match(block, /onClick: \(event\) => \{/);
  assert.match(block, /event\.altKey === true/);
  assert.match(block, /collapseKeysOf\(tree, group\.id, row\.path\)/);
  assert.match(block, /onToggleDirectory\(row\.collapseKey\)/);
});
