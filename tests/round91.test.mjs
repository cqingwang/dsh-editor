import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
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

const isWorkspaceMenu = load('isWorkspaceMenu');

test('the workspace "..." menu is told apart from every other menu', () => {
  /* The label set is what identifies it: the Session menu shares the same
     `[role=menu]` container, and injecting "Editor" there would be wrong. */
  assert.equal(isWorkspaceMenu(['重命名', '在 Finder 中显示', '删除工作区']), true);
  assert.equal(isWorkspaceMenu(['重命名', '在访达中显示', '删除工作区']), true);
  assert.equal(isWorkspaceMenu(['重命名', '删除会话']), false);
  assert.equal(isWorkspaceMenu([]), false);
  assert.equal(isWorkspaceMenu(null), false);
});

test('the injected item sits before Rename, IDEA\'s ordering for "open editor"', () => {
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  assert.notEqual(start, -1, 'ensureWorkspaceEditorItem is missing');
  const block = source.slice(start, start + 5200);
  assert.match(block, /first\.parentElement\?\.insertBefore\(clone, first\)/);
  assert.match(block, /data-dsh-editor-menu-item/);
  /* It must reuse the split activation, not re-implement it. */
  assert.match(block, /openEditorSplit/);
});

test('the detector reads the whole item text, not a nested empty span', () => {
  /* The host wraps the icon in a span that itself contains a span, so
     `querySelector('span:last-child')` returned the EMPTY icon node: the labels came
     back as ['', '', ''] and the menu was never recognised. */
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  const block = source.slice(start, start + 5200);
  assert.match(block, /items\.map\(\(item\) => \(item\.textContent \?\? ''\)\.trim\(\)\)/);
  assert.doesNotMatch(block, /querySelector\('span:last-child'\)\s*;/);
});

test('the injected row is put back after the host re-renders the menu', () => {
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  const block = source.slice(start, start + 3600);
  assert.match(block, /menu\.__dshEditorWatch = true/);
  assert.match(block, /new MutationObserver\(/);
  /* A bounded rescan also catches a menu that was re-mounted as a new element. */
  assert.match(source, /function scheduleMenuRescan\(\)/);
});
