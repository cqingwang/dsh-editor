import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function contextMenu() {
  return source;
}

test('menu actions expose the clean label instead of label + shortcut glyphs', () => {
  const menu = contextMenu();
  assert.match(menu, /data-menu-item-id=\{item\.id\}[\s\S]*?aria-label=\{item\.label\}/);
  assert.match(menu, /data-menu-item-id=\{child\.id\}[\s\S]*?aria-label=\{child\.label\}/);
});

test('shortcut and submenu metadata stay separate from the accessible name', () => {
  const menu = contextMenu();
  assert.match(menu, /aria-keyshortcuts=\{item\.ariaKeyShortcuts\}/);
  assert.match(menu, /aria-keyshortcuts=\{child\.ariaKeyShortcuts\}/);
  assert.match(menu, /aria-haspopup=\{Array\.isArray\(item\.items\)/);
  assert.match(menu, /aria-expanded=\{Array\.isArray\(item\.items\)/);
  assert.match(menu, /item\.shortcut === undefined \|\| item\.shortcut === ''/);
});
