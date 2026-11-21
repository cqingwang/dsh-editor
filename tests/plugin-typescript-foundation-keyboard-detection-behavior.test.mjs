import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptSource } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const executable = transpileTypeScriptSource(source);
const foundation = new Function(
  'require',
  `${executable}
return {
  doubleShiftAction,
  ideaFindStepShortcutAction,
  ideaUsageFamilyShortcut,
  ideaUsageFamilyShortcutAction,
  findActionShortcutMatches,
  searchHistoryShortcutMatches,
  isMacPlatform,
  ideaControlKeyModifier,
  isMonacoCancellation,
  searchEverywhereNextFocusIndex,
};`,
)((id) => (id === 'react-dom/client' ? { createRoot: () => {} } : {}));

test('TypeScript foundation keeps keyboard detection behavior', () => {
  assert.deepEqual(foundation.doubleShiftAction(100, { key: 'Shift' }, 300), { lastAt: 0, open: true });
  assert.deepEqual(foundation.doubleShiftAction(100, { key: 'Shift', altKey: true }, 300), {
    lastAt: 0,
    open: false,
  });
  assert.equal(foundation.ideaUsageFamilyShortcutAction({ key: 'u', ctrlKey: true }, true), 'findUsages');
  assert.equal(
    foundation.ideaUsageFamilyShortcutAction({ key: 'F7', altKey: true, ctrlKey: true }, false),
    'showUsages',
  );
  assert.equal(foundation.ideaUsageFamilyShortcut('showUsages', true), '⌃⌥U');
  assert.equal(foundation.ideaFindStepShortcutAction({ key: 'F3' }, false), 1);
  assert.equal(foundation.ideaFindStepShortcutAction({ key: 'F3', shiftKey: true }, false), -1);
  assert.equal(foundation.findActionShortcutMatches({ key: 'a', ctrlKey: true, shiftKey: true }, false), true);
  assert.equal(foundation.searchHistoryShortcutMatches({ key: 'ArrowDown', altKey: true }), true);
});

test('TypeScript foundation keeps platform and diagnostic helpers behavior', () => {
  assert.equal(foundation.isMacPlatform('MacIntel'), true);
  assert.equal(foundation.isMacPlatform('Linux x86_64'), false);
  assert.equal(foundation.ideaControlKeyModifier({ KeyMod: { WinCtrl: 2048, CtrlCmd: 2048 } }, 'MacIntel'), 2048);
  const monacoStack = 'Error: Canceled\n    at monaco/vs/editor/editor.main.js:1:1';
  assert.equal(foundation.isMonacoCancellation({ name: 'Canceled', message: 'Canceled' }, monacoStack), true);
  assert.equal(foundation.isMonacoCancellation(new TypeError('Canceled'), monacoStack), false);
  assert.equal(foundation.searchEverywhereNextFocusIndex(3, 2, false), 0);
  assert.equal(foundation.searchEverywhereNextFocusIndex(3, 0, true), 2);
});
