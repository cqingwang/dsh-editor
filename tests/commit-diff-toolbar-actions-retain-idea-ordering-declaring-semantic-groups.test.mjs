import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/diff-preview.legacy.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('Diff toolbar actions retain IDEA ordering while declaring semantic groups', () => {
  const start = source.indexOf('const diffToolbarActions =');
  const end = source.indexOf('const hidden =', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  const ids = [...block.matchAll(/id: '(swapSides|disableEditing|focusOppositePane|selectPositionInOppositePane|reloadDiff|find|collapse|goToChange|settings|undo|redo|selection)'/g)]
    .map((match) => match[1]);
  assert.deepEqual(ids, [
    'swapSides',
    'disableEditing',
    'focusOppositePane',
    'selectPositionInOppositePane',
    'reloadDiff',
    'find',
    'collapse',
    'goToChange',
    'settings',
    'undo',
    'redo',
    'selection',
  ]);
  assert.doesNotMatch(block, /id: 'view'/);
  assert.match(source, /React\.createElement\(DiffViewModeControl, \{/);
  assert.match(block, /id: 'focusOppositePane',[\s\S]*?group: 'selection'/);
  assert.match(block, /id: 'reloadDiff',[\s\S]*?group: 'inspect'/);
  assert.match(block, /id: 'undo',[\s\S]*?group: 'history'/);
});

const groupDiffToolbarActions = new Function(
  `${extract('groupDiffToolbarActions')}\nreturn groupDiffToolbarActions;`,
)();

test('groupDiffToolbarActions inserts separators only at group boundaries', () => {
  const actions = [
    { id: 'open', group: 'open' },
    { id: 'view', group: 'mode' },
    { id: 'swap', group: 'mode' },
    { id: 'focus', group: 'selection' },
    { id: 'reload', group: 'inspect' },
    { id: 'undo', group: 'history' },
  ];
  assert.deepEqual(groupDiffToolbarActions(actions), [
    actions[0],
    null,
    actions[1],
    actions[2],
    null,
    actions[3],
    null,
    actions[4],
    null,
    actions[5],
  ]);
});

test('both wide Diff toolbar and overflow menu use grouped actions', () => {
  assert.match(source, /const directDiffActionEntries = groupDiffToolbarActions\(directDiffActions\)/);
  assert.match(source, /const hiddenDiffActionEntries = groupDiffToolbarActions\(hiddenDiffActions\)/);
  assert.match(source, /directDiffActionEntries\.map/);
  assert.match(source, /items: hiddenDiffActionEntries\.map/);
});
