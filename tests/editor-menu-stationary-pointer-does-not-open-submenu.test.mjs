import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8');

test('hover submenu activation requires pointer movement after the menu opens', () => {
  const canOpen = new Function(
    `${transpileTypeScriptFunction(source, 'contextMenuHoverOpensSubmenu')}\nreturn contextMenuHoverOpensSubmenu;`,
  )();
  assert.equal(canOpen(true, false), false);
  assert.equal(canOpen(false, true), false);
  assert.equal(canOpen(true, true), true);
});

test('ContextMenu tracks pointer movement and guards onMouseEnter', () => {
  assert.match(source, /const pointerMovedSinceOpenRef = React\.useRef\(false\);/u);
  assert.match(source, /window\.addEventListener\('pointermove'/u);
  assert.match(
    source,
    /if \(!contextMenuHoverOpensSubmenu\(hasChildren, pointerMovedSinceOpenRef\.current\)\) return;/u,
  );
});
