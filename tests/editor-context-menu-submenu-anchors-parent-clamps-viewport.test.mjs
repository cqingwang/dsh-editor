import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('..', import.meta.url);
const menuModel = await readFile(new URL('src/client/components/ui/menu-model.ts', root), 'utf8');
const menuComponent = await readFile(new URL('src/client/components/ui/Menu.tsx', root), 'utf8');
const menuStyles = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineMenuStyles = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');
const helpers = loadTypeScriptModule(menuModel, ['submenuVerticalGeometry']);

test('submenu vertical geometry opens toward the side with usable viewport space', () => {
  assert.deepEqual(
    helpers.submenuVerticalGeometry({ parentTop: 539, parentBottom: 563, viewportHeight: 576 }),
    { side: 'up', maxHeight: 555 },
  );
  assert.deepEqual(
    helpers.submenuVerticalGeometry({ parentTop: 10, parentBottom: 34, viewportHeight: 576 }),
    { side: 'down', maxHeight: 558 },
  );
  assert.deepEqual(helpers.submenuVerticalGeometry(null), { side: 'down', maxHeight: 480 });
});

test('submenus anchor to their item and clamp their border box to the viewport', () => {
  assert.match(
    menuComponent,
    /import \{[^}]*contextMenuMaxHeight[^}]*submenuGeometry[^}]*submenuVerticalGeometry[^}]*\} from '\.\/menu-model'/u,
  );
  assert.match(menuComponent, /submenuVerticalGeometry\(\{/u);
  assert.match(menuComponent, /verticalPlacement\.side === 'up'/u);
  assert.match(menuComponent, /maxHeight: verticalPlacement\.maxHeight/u);
  assert.match(menuComponent, /overflowY: 'auto'/u);
  assert.match(menuComponent, /style=\{styles\.menuScroll\}/u);
  assert.match(menuComponent, /data-submenu-id=\{submenu\}/u);
  assert.match(menuStyles, /menuScroll: \{[\s\S]*?minHeight: 0,[\s\S]*?overflowY: 'auto'/u);
  assert.match(
    inlineMenuStyles,
    /menuScroll: \{[\s\S]*?minHeight: 0,[\s\S]*?overflowY: 'auto'/u,
  );
});
