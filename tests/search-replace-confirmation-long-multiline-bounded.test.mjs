import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const confirmation = await readFile(
  new URL('../src/client/components/search/search-replace-confirmation.ts', import.meta.url),
  'utf8',
);

test('Replace confirmation bounds a long multiline message inside the viewport', () => {
  assert.match(confirmation, /dialog\.style\.boxSizing = 'border-box'/u);
  assert.match(confirmation, /dialog\.style\.maxHeight = 'min\(72vh, 640px\)'/u);
  assert.match(confirmation, /dialog\.style\.overflow = 'hidden'/u);
  assert.match(confirmation, /title\.style\.flex = 'none'/u);
  assert.match(confirmation, /message\.style\.flex = '1 1 auto'/u);
  assert.match(confirmation, /message\.style\.minHeight = '0'/u);
  assert.match(confirmation, /message\.style\.overflowY = 'auto'/u);
  assert.match(confirmation, /buttons\.style\.flex = 'none'/u);
});

test('the bounded message keeps the full exact query and replacement text', () => {
  assert.match(confirmation, /messageText\.textContent = t\('editor\.searchReplaceConfirm', \{/u);
  assert.match(confirmation, /query,/u);
  assert.match(confirmation, /replacement,/u);
  assert.match(confirmation, /messageText\.style\.whiteSpace = 'pre-wrap'/u);
  assert.match(confirmation, /messageText\.style\.overflowWrap = 'anywhere'/u);
});
