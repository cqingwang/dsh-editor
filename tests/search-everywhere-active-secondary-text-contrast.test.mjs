import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const searchEverywhere = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const searchFileResultItem = await readFile(
  new URL('../src/client/components/search/SearchFileResultItem.tsx', import.meta.url),
  'utf8',
);
const quickOpen = await readFile(
  new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url),
  'utf8',
);
const css = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');

test('search palette rows keep title and secondary text legible on the selected blue row', () => {
  assert.match(searchEverywhere, /className='dsh-editor-search-result-name'/u);
  assert.match(searchEverywhere, /className='dsh-editor-search-result-detail dsh-editor-search-everywhere-meta'/u);
  assert.match(searchFileResultItem, /className='dsh-editor-search-result-name'/u);
  assert.match(searchFileResultItem, /className='dsh-editor-search-result-detail dsh-editor-search-everywhere-meta'/u);
  assert.match(quickOpen, /className='dsh-editor-search-result-name'/u);
  assert.match(quickOpen, /className='dsh-editor-search-result-detail'/u);
  assert.match(css, /\[role="option"\]\[aria-selected="true"\] \.dsh-editor-search-result-name/u);
  assert.match(css, /\[role="option"\]\[aria-selected="true"\] \.dsh-editor-search-result-detail/u);
  assert.match(css, /\[role="option"\]\[aria-selected="true"\] \.dsh-editor-search-everywhere-meta/u);
  assert.match(css, /\[role="option"\]\[aria-selected="true"\] \.dsh-editor-search-everywhere-category/u);
  assert.match(css, /\[role="option"\]\[aria-selected="true"\] \.dsh-editor-search-everywhere-shortcut/u);
  assert.match(css, /color: light-dark\(#fff, #111\) !important/u);
  assert.match(css, /opacity: 0\.84/u);
});
