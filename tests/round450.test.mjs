import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function changeMenu() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Commit Change row menu exposes its IDEA keyboard shortcuts', () => {
  const menu = changeMenu();
  assert.match(menu, /id: 'rollbackWorking',[\s\S]*?ariaKeyShortcuts: 'Alt\+Meta\+Z Control\+Alt\+Z'/);
  assert.match(menu, /id: 'diff',[\s\S]*?ariaKeyShortcuts: 'Meta\+D Control\+D'/);
  assert.match(menu, /ariaKeyShortcuts: removalOnly\s+\? undefined\s+: allStaged\s+\? 'Alt\+Meta\+A Control\+Alt\+A'\s+: 'Meta\+Shift\+A Control\+Shift\+A'/);
});
