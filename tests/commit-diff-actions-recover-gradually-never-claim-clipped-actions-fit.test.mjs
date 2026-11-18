import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/context-menu.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('./fixtures/diff-preview.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

const actions = [
  { id: 'view', group: 'mode' },
  { id: 'applyLeftSide', group: 'mode' },
  { id: 'swapSides', group: 'mode' },
  { id: 'focusOppositePane', group: 'selection' },
  { id: 'reloadDiff', group: 'inspect' },
  { id: 'find', group: 'inspect' },
  { id: 'collapse', group: 'inspect' },
  { id: 'settings', group: 'inspect' },
  { id: 'openLocalVersion', group: 'open' },
  { id: 'undo', group: 'history' },
  { id: 'redo', group: 'history' },
];

const directCountForWidth = new Function(
  `${extract('groupDiffToolbarActions')}\n${extract('diffDirectActionCountForWidth')}\nreturn diffDirectActionCountForWidth;`,
)();

test('Diff actions recover gradually and never claim clipped actions fit', () => {
  const narrow = directCountForWidth(220, 220, actions);
  const medium = directCountForWidth(420, 220, actions);
  const wider = directCountForWidth(520, 220, actions);
  assert.equal(narrow, 0);
  assert.ok(medium > 0 && medium < actions.length);
  assert.ok(wider >= medium && wider < actions.length);
  assert.equal(directCountForWidth(1200, 220, actions), actions.length);
});

test('Diff toolbar measures fixed controls and slices only hidden actions into overflow', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /data-dsh-diff-fixed/);
  assert.match(diff, /diffDirectActionCountForWidth\(/);
  assert.match(diff, /const directDiffActions = diffToolbarActions\.slice\(0, resolvedDirectActionCount\)/);
  assert.match(diff, /const hiddenDiffActions = diffToolbarActions\.slice\(resolvedDirectActionCount\)/);
  assert.match(diff, /const hiddenDiffActionEntries = groupDiffToolbarActions\(hiddenDiffActions\)/);
  assert.match(diff, /const directDiffActionEntries = groupDiffToolbarActions\(directDiffActions\)/);
  assert.match(diff, /items: hiddenDiffActionEntries\.map/);
  assert.match(diff, /directDiffActionEntries\.map/);
});

test('ContextMenu renders null entries inside submenus as separators', () => {
  const menu = source.slice(
    source.indexOf('function ContextMenu({ menu, onClose, t })'),
    source.indexOf('function groupDiffToolbarActions('),
  );
  assert.match(
    menu,
    /item\.items\.map\(\(child, childIndex\) =>\s+child === null\s+\? React\.createElement\('div', \{ key: `submenu-sep-\$\{childIndex\}`, style: styles\.menuSeparator, role: 'separator' \}\)/,
  );
});
