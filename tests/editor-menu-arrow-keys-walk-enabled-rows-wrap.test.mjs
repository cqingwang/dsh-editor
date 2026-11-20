import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/components/ui/Menu.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

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
const menuTypeaheadTarget = load('menuTypeaheadTarget');

test('menu arrow keys walk enabled rows and wrap', () => {
  const items = [{ id: 'a' }, null, { id: 'b', disabled: true }, { id: 'c' }, { id: 'd' }];
  assert.equal(menuStep(items, -1, 'ArrowDown'), 0);
  assert.equal(menuStep(items, -1, 'ArrowUp'), 4);
  assert.equal(menuStep(items, 0, 'ArrowDown'), 3);
  assert.equal(menuStep(items, 3, 'ArrowDown'), 4);
  assert.equal(menuStep(items, 4, 'ArrowDown'), 0);
  assert.equal(menuStep(items, 0, 'ArrowUp'), 4);
  assert.equal(menuStep(items, 3, 'Home'), 0);
  assert.equal(menuStep(items, 0, 'End'), 4);
  assert.equal(menuStep(items, -1, 'Home'), 0);
  assert.equal(menuStep(items, -1, 'End'), 4);
});

test('menu page keys move by a bounded page instead of a single row', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({ id: `item-${index}` }));
  assert.equal(menuStep(items, 0, 'PageDown', 5), 5);
  assert.equal(menuStep(items, 5, 'PageDown', 5), 10);
  assert.equal(menuStep(items, 10, 'PageDown', 5), 11);
  assert.equal(menuStep(items, 11, 'PageUp', 5), 6);
  assert.equal(menuStep(items, 6, 'PageUp', 5), 1);
  assert.equal(menuStep(items, 1, 'PageUp', 5), 0);
  assert.equal(menuStep(items, -1, 'PageDown', 5), 0);
  assert.equal(menuStep(items, -1, 'PageUp', 5), 11);
});

test('a menu with no enabled rows leaves focus alone', () => {
  assert.equal(menuStep([null, { disabled: true }], 0, 'ArrowDown'), -1);
});

test('menu typeahead skips disabled rows, cycles matches and supports CJK', () => {
  const items = [
    { label: 'Project Files' },
    null,
    { label: 'Open Files' },
    { label: 'All Changed Files', disabled: true },
    { label: 'Open Recent' },
    { label: '打开文件' },
  ];
  assert.equal(menuTypeaheadTarget(items, 0, 'o'), 2);
  assert.equal(menuTypeaheadTarget(items, 2, 'O'), 4);
  assert.equal(menuTypeaheadTarget(items, 4, 'o'), 2);
  assert.equal(menuTypeaheadTarget(items, 0, 'a'), -1);
  assert.equal(menuTypeaheadTarget(items, 0, '打'), 5);
  assert.equal(menuTypeaheadTarget(items, 0, 'x'), -1);
  assert.equal(menuTypeaheadTarget(items, -1, 'op'), 2);
  assert.equal(menuTypeaheadTarget([{ label: 'Copy Path' }, { label: 'Copy as Patch' }], 0, 'co'), 0);
});

test('ContextMenu owns arrow, Home/End and paged navigation, initial focus and return focus', () => {
  const menu = source;
  assert.match(menu, /const returnFocusRef = React\.useRef<HTMLElement \| null>\(null\)/);
  assert.match(
    menu,
    /querySelector<HTMLButtonElement>\(\s*'\[data-menu-scroll\] button\[data-menu-item-id\]:not\(:disabled\)'/,
  );
  assert.match(menu, /previous !== null && previous\.isConnected\) previous\.focus\(\)/);
  assert.match(
    menu,
    /event\.key === 'ArrowDown' \|\|\s+event\.key === 'ArrowUp' \|\|\s+event\.key === 'Home' \|\|\s+event\.key === 'End'/,
  );
  assert.match(menu, /event\.key === 'PageDown' \|\|\s+event\.key === 'PageUp'/u);
  assert.match(menu, /menuStep\(/);
  assert.match(menu, /const buttons = submenu === null \? topButtons\(\) : childButtons\(submenu\)/);
  assert.match(menu, /data-menu-item-id/);
  assert.match(menu, /window\.setTimeout\(\(\) => childButtons\(item\.id\)\[0\]\?\.focus\(\), 0\)/);
});

test('ContextMenu maps printable keys through shared typeahead', () => {
  assert.match(source, /menuTypeaheadTarget/u);
  assert.match(source, /event\.key\.length === 1/u);
  assert.match(source, /event\.isComposing/u);
  assert.match(source, /typeaheadPrefixRef/u);
});

test('keyboard invocation of Project overflow actions has a tree fallback anchor', () => {
  const create = source.slice(
    source.indexOf('onOpenCreateMenu: (event) => {'),
    source.indexOf('onOpenOptions: (event) => {'),
  );
  assert.match(create, /event\?\.currentTarget\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(create, /\?\? treeRef\.current\?\.getBoundingClientRect\(\)/);
  const options = source.slice(
    source.indexOf('onOpenOptions: (event) => {'),
    source.indexOf('onCreateChange: (value) =>'),
  );
  assert.match(options, /event\?\.currentTarget\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(options, /\?\? treeRef\.current\?\.getBoundingClientRect\(\)/);
});
