import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function treeMenu() {
  const start = source.indexOf('const buildTreeMenu = React.useCallback(');
  const end = source.indexOf('/* Move one entry into a directory', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Project tree context actions expose their IDEA keyboard shortcuts', () => {
  const menu = treeMenu();
  assert.match(menu, /id: 'newFile',[\s\S]*?ariaKeyShortcuts: 'Alt\+Meta\+N Control\+Alt\+N'/);
  assert.match(menu, /id: 'rename',[\s\S]*?ariaKeyShortcuts: 'Shift\+F6'/);
  assert.match(menu, /id: 'moveTo',[\s\S]*?ariaKeyShortcuts: 'F6'/);
  assert.match(menu, /id: 'delete',[\s\S]*?ariaKeyShortcuts: 'Backspace'/);
  assert.match(menu, /id: 'open',[\s\S]*?ariaKeyShortcuts: isDirectory \? undefined : 'F4'/);
  assert.match(menu, /id: 'refresh',[\s\S]*?ariaKeyShortcuts: 'Meta\+R Control\+R'/);
});
