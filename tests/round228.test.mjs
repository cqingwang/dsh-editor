import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function changeMenu() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('conflict resolution is a submenu before Copy Reference and stage actions', () => {
  const menu = changeMenu();
  const open = menu.indexOf("id: 'open'");
  const resolve = menu.indexOf("id: 'resolveConflicts'");
  const copyPath = menu.indexOf("id: 'copyReference'");
  const stage = menu.indexOf("id: removalOnly ? 'removeDeleted' : 'stage'");
  const compare = menu.indexOf("id: 'compareRevision'");
  assert.ok(open >= 0 && resolve > open && copyPath > resolve && stage > copyPath && compare > stage);
  assert.match(menu, /id: 'resolveConflicts',[\s\S]*?items: \[[\s\S]*?id: 'acceptOurs'[\s\S]*?id: 'acceptTheirs'/);
  assert.match(menu, /resolveConflict\(paths, 'ours'\)/);
  assert.match(menu, /resolveConflict\(paths, 'theirs'\)/);
});

test('conflict labels are localised and no flat accept siblings remain', () => {
  assert.match(source, /resolveConflicts: '解决冲突',/);
  assert.match(source, /resolveConflicts: 'Resolve Conflicts',/);
  const menu = changeMenu();
  assert.doesNotMatch(menu, /null,\s+allConflicts\s+\?\s+\{ id: 'acceptOurs'/);
});
