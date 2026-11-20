import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('..', import.meta.url);
const menuModel = await readFile(new URL('src/client/components/ui/menu-model.ts', root), 'utf8');
const menuComponent = await readFile(new URL('src/client/components/ui/Menu.tsx', root), 'utf8');
const menuStyles = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineMenuStyles = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');
const helpers = loadTypeScriptModule(menuModel, ['contextMenuMaxHeight']);

test('context menu height never exceeds the viewport margin', () => {
  assert.equal(helpers.contextMenuMaxHeight(576, undefined), 568);
  assert.equal(helpers.contextMenuMaxHeight(576, 380), 380);
  assert.equal(helpers.contextMenuMaxHeight(576, 900), 568);
  assert.equal(helpers.contextMenuMaxHeight(80, undefined), 72);
});

test('ContextMenu applies the shared viewport cap to every menu', () => {
  assert.match(
    menuComponent,
    /import \{[^}]*contextMenuMaxHeight[^}]*submenuGeometry[^}]*submenuVerticalGeometry[^}]*\} from '\.\/menu-model'/u,
  );
  assert.match(
    menuComponent,
    /React\.useState\(\(\) =>\s+contextMenuMaxHeight\(window\.innerHeight, menu\.maxHeight\)/u,
  );
  assert.match(menuComponent, /window\.addEventListener\('resize', clampHeight\)/u);
  assert.match(menuComponent, /window\.addEventListener\('resize', placeMenu\)/u);
  assert.match(menuComponent, /maxHeight: menuHeight/u);
  assert.match(menuComponent, /overflowY: 'auto'/u);
  assert.match(menuComponent, /\[menu, menuHeight\]/u);
  assert.match(menuStyles, /menu: \{\s+position: 'fixed',[\s\S]*?boxSizing: 'border-box',[\s\S]*?\n  \},\n  menuItem:/u);
  assert.match(
    inlineMenuStyles,
    /menu: \{\s+position: 'fixed',[\s\S]*?boxSizing: 'border-box',[\s\S]*?\n  \},\n  menuItem:/u,
  );
});
