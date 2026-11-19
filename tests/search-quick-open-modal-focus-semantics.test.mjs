import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');

test('Quick Open is a modal dialog whose Tab focus stays inside', () => {
  assert.match(component, /import \{ searchEverywhereNextFocusIndex \} from '\.\.\/\.\.\/foundation';/u);
  assert.match(component, /role='dialog'\s+aria-modal='true'/u);
  assert.match(component, /const trapQuickOpenFocus = \(event: React\.KeyboardEvent<HTMLDivElement>\): void =>/u);
  assert.match(component, /event\.key !== 'Tab'/u);
  assert.match(
    component,
    /searchEverywhereNextFocusIndex\(focusables\.length, currentIndex, event\.shiftKey === true\)/u,
  );
  assert.match(component, /focusables\[nextIndex\]\?\.focus\?\.\(\)/u);
  assert.match(component, /onKeyDown=\{trapQuickOpenFocus\}/u);
});
