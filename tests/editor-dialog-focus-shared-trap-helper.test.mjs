import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractFunctionSource, loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const helperSource = await readFile(new URL('src/client/components/ui/focus-trap.ts', root), 'utf8');
const foundationSource = await readFile(new URL('src/client/foundation.ts', root), 'utf8');
const nextFocusIndexSource = extractFunctionSource(foundationSource, 'searchEverywhereNextFocusIndex');
const helpers = loadTypeScriptModule(`${nextFocusIndexSource}\n${helperSource}`, [
  'dialogFocusableElements',
  'nextDialogFocusTarget',
  'trapDialogFocus',
]);

test('shared dialog focus helper wraps forwards and backwards', () => {
  const first = { name: 'first' };
  const middle = { name: 'middle' };
  const last = { name: 'last' };
  const focusables = [first, middle, last];
  assert.equal(helpers.nextDialogFocusTarget(focusables, middle, false, false), last);
  assert.equal(helpers.nextDialogFocusTarget(focusables, first, true, false), last);
  assert.equal(helpers.nextDialogFocusTarget(focusables, null, false, false), null);
  assert.equal(helpers.nextDialogFocusTarget(focusables, null, false, true), first);
  assert.equal(helpers.nextDialogFocusTarget([], null, false, true), null);
});

test('all modal search surfaces reuse the shared focus-trap building block', async () => {
  const sources = await Promise.all(
    [
      'src/client/components/search/FindToolPopup.tsx',
      'src/client/components/search/SearchEverywhere.tsx',
      'src/client/components/search/FindToolWindow.tsx',
      'src/client/components/search/QuickOpen.tsx',
    ].map((path) => readFile(new URL(path, root), 'utf8')),
  );
  for (const source of sources) {
    assert.match(source, /trapDialogFocus/u);
    assert.doesNotMatch(source, /querySelectorAll<HTMLElement>\(selector\)/u);
  }
  const uiIndex = await readFile(new URL('src/client/components/ui/index.tsx', root), 'utf8');
  assert.match(uiIndex, /trapDialogFocus/u);
  assert.match(uiIndex, /dialogFocusableElements/u);
});
