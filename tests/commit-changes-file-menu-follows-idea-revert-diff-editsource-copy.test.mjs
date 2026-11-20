import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function changeMenu() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

test('Changes file menu follows IDEA Revert, Diff, EditSource, Copy Reference priority', () => {
  const menu = changeMenu();
  const ids = [
    "id: 'rollback'",
    "id: 'diff'",
    "id: 'combinedDiff'",
    "id: 'open'",
    "id: 'resolveConflicts'",
    "id: 'copyReference'",
    "id: removalOnly ? 'removeDeleted' : 'stage'",
    "id: 'gitignore'",
    "id: 'createPatch'",
    "id: 'copyPatch'",
    "id: 'history'",
    "id: 'reveal'",
    "id: 'openTerminal'",
    "id: 'compareRevision'",
    "id: 'compareHead'",
    "id: 'compareClipboard'",
  ];
  const positions = ids.map((id) => menu.indexOf(id));
  assert.ok(
    positions.every((position) => position >= 0),
    'every expected IDEA action should exist',
  );
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index] > positions[index - 1], `${ids[index]} should follow ${ids[index - 1]}`);
  }
});

test('Changes menu uses IDEA separators and patch ordering', () => {
  const menu = changeMenu();
  assert.ok((menu.match(/\bnull,/g) ?? []).length >= 4, 'IDEA action groups must remain separated');
  assert.match(menu, /id: 'rollback'[\s\S]*?id: 'diff'/);
  assert.match(menu, /id: 'copyReference'[\s\S]*?id: removalOnly \? 'removeDeleted' : 'stage'/);
  assert.match(menu, /id: 'createPatch'[\s\S]*?id: 'copyPatch'/);
  assert.match(menu, /id: 'openTerminal'[\s\S]*?id: 'compareRevision'/);
});

test('Changes menu keeps multi-row safety and IDEA dirty-group order', () => {
  const menu = changeMenu();
  assert.match(menu, /id: 'combinedDiff',[\s\S]*?disabled: paths\.length < 2/);
  assert.match(menu, /id: 'compareRevision',[\s\S]*?disabled: paths\.length > 1/);
  assert.match(menu, /id: 'compareHead',[\s\S]*?disabled: paths\.length > 1 \|\| !changeModel\.canCompareWithHead/);
  assert.match(menu, /id: 'compareClipboard',[\s\S]*?disabled: paths\.length > 1/);
});
