import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
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

const menuStep = load('menuStep');

test('menu arrow keys walk enabled rows and wrap', () => {
  const items = [
    { id: 'a' },
    null,
    { id: 'b', disabled: true },
    { id: 'c' },
    { id: 'd' },
  ];
  assert.equal(menuStep(items, -1, 'ArrowDown'), 0);
  assert.equal(menuStep(items, -1, 'ArrowUp'), 4);
  assert.equal(menuStep(items, 0, 'ArrowDown'), 3);
  assert.equal(menuStep(items, 3, 'ArrowDown'), 4);
  assert.equal(menuStep(items, 4, 'ArrowDown'), 0);
  assert.equal(menuStep(items, 0, 'ArrowUp'), 4);
});

test('a menu with no enabled rows leaves focus alone', () => {
  assert.equal(menuStep([null, { disabled: true }], 0, 'ArrowDown'), -1);
});

test('ContextMenu owns Up/Down, initial focus and return focus', () => {
  const menu = source.slice(source.indexOf('function ContextMenu('), source.indexOf('/**\n     * A tool-window splitter'));
  assert.match(menu, /const returnFocusRef = React\.useRef\(null\)/);
  assert.match(menu, /querySelector\('button\[data-menu-item-id\]:not\(:disabled\)'\)/);
  assert.match(menu, /previous !== null && previous\.isConnected\) previous\.focus\(\)/);
  assert.match(menu, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(menu, /const buttons = submenu === null \? topButtons\(\) : childButtons\(submenu\)/);
  assert.match(menu, /data-menu-item-id/);
  assert.match(menu, /window\.setTimeout\(\(\) => childButtons\(item\.id\)\[0\]\?\.focus\(\), 0\)/);
});

test('keyboard invocation of Project overflow actions has a tree fallback anchor', () => {
  const create = source.slice(source.indexOf('onOpenCreateMenu: (event) => {'), source.indexOf('onOpenOptions: (event) => {'));
  assert.match(create, /event\?\.currentTarget\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(create, /\?\? treeRef\.current\?\.getBoundingClientRect\(\)/);
  const options = source.slice(source.indexOf('onOpenOptions: (event) => {'), source.indexOf('onCreateChange: (value) =>'));
  assert.match(options, /event\?\.currentTarget\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(options, /\?\? treeRef\.current\?\.getBoundingClientRect\(\)/);
});
