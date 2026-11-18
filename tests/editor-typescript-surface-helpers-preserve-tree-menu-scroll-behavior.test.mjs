import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/injected-css.ts');
const helpers = loadTypeScriptModule(source, [
  'isNearBottom',
  'isWorkspaceMenu',
  'jumpBadgeLabel',
  'jumpBadgeVisible',
  'maintenanceDelay',
  'menuArrowTarget',
  'pathWithLine',
  'pickMenuIcon',
  'restoreScrollTop',
  'shellQuote',
  'shiftWheelScrollLeft',
  'shouldShowTreeLoading',
  'sidebarNeedsCollapse',
  'snapSplitPercent',
  'terminalShortcutAction',
  'wheelScrollTop',
]);

test('TypeScript surface helpers preserve tree, menu and scroll behavior', () => {
  assert.equal(helpers.shouldShowTreeLoading({ loading: true, rowCount: 0 }), true);
  assert.equal(helpers.shouldShowTreeLoading({ loading: true, rowCount: 1 }), false);
  assert.equal(helpers.isWorkspaceMenu(['Rename', 'Delete workspace']), true);
  assert.equal(helpers.isWorkspaceMenu(['Rename', 'Archive']), false);
  assert.equal(helpers.restoreScrollTop({ remembered: 140, max: 100 }), 100);
  assert.equal(helpers.restoreScrollTop({ remembered: null, max: 100 }), null);
  assert.equal(helpers.maintenanceDelay(1000, 1040, 80), 40);
  assert.equal(helpers.snapSplitPercent(52), 50);
  assert.equal(helpers.snapSplitPercent(10), 20);
  assert.equal(helpers.sidebarNeedsCollapse(280), true);
  assert.equal(helpers.sidebarNeedsCollapse(56), false);
  assert.equal(helpers.menuArrowTarget(0, 'ArrowUp', 0), 0);
  assert.equal(helpers.menuArrowTarget(1, 'ArrowDown', 2), 2);
  assert.equal(helpers.pickMenuIcon(['missing', 'split'], new Set(['split'])), 'split');
});

test('TypeScript surface helpers preserve chat and terminal semantics', () => {
  assert.deepEqual(helpers.terminalShortcutAction(false, false), { open: true, restoreFocus: false });
  assert.deepEqual(helpers.terminalShortcutAction(true, true), { open: false, restoreFocus: true });
  assert.equal(helpers.jumpBadgeLabel(0), '↓');
  assert.equal(helpers.jumpBadgeLabel(120), '↓ 99+');
  assert.equal(helpers.jumpBadgeVisible({ scrollTop: 20, max: 100, hasNew: true }), true);
  assert.equal(helpers.jumpBadgeVisible({ scrollTop: 90, max: 100, hasNew: true }), false);
  assert.equal(helpers.isNearBottom(null), true);
  assert.equal(helpers.wheelScrollTop({ scrollTop: 90, deltaY: 40, max: 100 }), 100);
  assert.equal(
    helpers.shiftWheelScrollLeft({
      shiftKey: true,
      deltaY: 30,
      scrollLeft: 10,
      scrollWidth: 200,
      clientWidth: 100,
    }),
    40,
  );
});

test('TypeScript surface helpers preserve reference copying', () => {
  assert.equal(helpers.pathWithLine('src/app.ts', { lineNumber: 3, column: 8 }, true), 'src/app.ts:3:8');
  assert.equal(helpers.pathWithLine('src/app.ts', { lineNumber: 3, column: 8 }, false), 'src/app.ts');
  assert.equal(helpers.shellQuote('src/plain.ts'), 'src/plain.ts');
  assert.equal(helpers.shellQuote('src/my file.ts'), "'src/my file.ts'");
});
