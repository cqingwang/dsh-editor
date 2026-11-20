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

function contextMenu() {
  return source;
}

test('Right opens a submenu and focuses its first enabled item', () => {
  const menu = contextMenu();
  assert.match(menu, /const openSubmenu = \(item: MenuAction\) => \{/);
  assert.match(menu, /setItemRect\(parent\.getBoundingClientRect\(\)\)/);
  assert.match(menu, /setSubmenu\(item\.id\)/);
  assert.match(menu, /setTimeout\(\(\) => childButtons\(item\.id\)\[0\]\?\.focus\(\), 0\)/);
  assert.match(menu, /event\.key === 'ArrowRight'/);
});

test('Left closes only the child menu and returns to its parent row', () => {
  const menu = contextMenu();
  assert.match(menu, /event\.key === 'ArrowLeft' && submenu !== null/);
  assert.match(
    menu,
    /const parentId = submenu;\s+setSubmenu\(null\);\s+window\.setTimeout\(\(\) => itemButton\(parentId\)\?\.focus\(\), 0\)/,
  );
});

test('Up/Down stay inside the open submenu instead of walking the parent menu', () => {
  const menu = contextMenu();
  assert.match(menu, /const buttons = submenu === null \? topButtons\(\) : childButtons\(submenu\)/);
  assert.match(menu, /buttons\[menuStep\(buttons, index, event\.key\)\]\?\.focus\(\)/);
});

test('every menu row carries its stable id for keyboard submenu navigation', () => {
  assert.match(source, /data-menu-item-id=\{item\.id\}/);
  assert.match(source, /data-menu-item-id=\{child\.id\}/);
});

test('Editor is still a View-row toggle, never an injected tab', () => {
  assert.doesNotMatch(source, /setAttribute\('data-dsh-editor-tab'/);
  const start = source.indexOf('function ensureChatToggle(');
  const block = source.slice(start, source.indexOf('function placeChatHandle(', start));
  assert.match(block, /data-dsh-editor-chat-toggle/);
  assert.match(block, /if \(active\) setActive\(false\);\s*else\s+openEditorSplit\(\);/u);
});
