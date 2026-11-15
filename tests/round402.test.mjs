import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const menu = source.slice(
  source.indexOf('function ContextMenu({ menu, onClose, t })'),
  source.indexOf('function groupDiffToolbarActions('),
);

test('activating a submenu parent updates its geometry anchor', () => {
  assert.match(menu, /onClick: \(event\) => \{\s+const parent = event\.currentTarget;/);
  assert.match(menu, /if \(Array\.isArray\(item\.items\) && item\.items\.length > 0\) \{\s+setItemRect\(parent\.getBoundingClientRect\(\)\);\s+setSubmenu\(item\.id\);/s);
});

test('keyboard activation moves focus into the first enabled submenu item', () => {
  assert.match(menu, /const keyboardActivation = event\.detail === 0;/);
  assert.match(
    menu,
    /if \(keyboardActivation\) \{\s+window\.setTimeout\(\(\) => \{\s+const nested = parent\.querySelector\('\[role="menu"\]'\);\s+nested\?\.querySelector\('button\[data-menu-item-id\]:not\(:disabled\)'\)\?\.focus\(\);\s+\}, 0\);\s+\}/s,
  );
});

test('Escape closes one submenu level and restores parent focus', () => {
  assert.match(menu, /if \(event\.key === 'Escape'\) \{[\s\S]*?if \(submenu === null\) \{[\s\S]*?onClose\(\);[\s\S]*?const parentId = submenu;[\s\S]*?setSubmenu\(null\);[\s\S]*?itemButton\(parentId\)\?\.focus\(\)/s);
});
