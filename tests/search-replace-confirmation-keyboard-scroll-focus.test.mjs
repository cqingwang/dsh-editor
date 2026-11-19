import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const confirmation = await readFile(
  new URL('../src/client/components/search/search-replace-confirmation.ts', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('the scrollable Replace details are a keyboard reachable tab stop', () => {
  assert.match(confirmation, /message\.tabIndex = 0/u);
  assert.match(confirmation, /message\.setAttribute\('aria-label', t\('editor\.searchReplaceConfirmDetails'\)\)/u);
  assert.match(confirmation, /message\.dataset\.dshSearchReplaceConfirmDetails = ''/u);
  assert.match(confirmation, /const tabStops = \[cancelButton, replaceButton, message\]/u);
});

test('Tab and Shift+Tab cycle all replacement-dialog focus targets', () => {
  assert.match(confirmation, /const currentIndex = tabStops\.indexOf\(document\.activeElement as HTMLElement\)/u);
  assert.match(confirmation, /const direction = event\.shiftKey === true \? -1 : 1/u);
  assert.match(
    confirmation,
    /tabStops\[\(currentIndex \+ direction \+ tabStops\.length\) % tabStops\.length\]\?\.focus\(\)/u,
  );
  assert.match(confirmation, /cancelButton\.focus\(\), 0/u);
});

test('the keyboard-scroll details label is localized', () => {
  assert.match(locales, /searchReplaceConfirmDetails: '替换详情'/u);
  assert.match(locales, /searchReplaceConfirmDetails: 'Replace details'/u);
});
