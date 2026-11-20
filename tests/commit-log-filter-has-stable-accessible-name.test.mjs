import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolbar = await readFile(
  new URL('../src/client/components/commit/CommitLogToolbar.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

const filterStart = toolbar.indexOf('<input');
const filterEnd = toolbar.indexOf('/>', filterStart);
const filter = toolbar.slice(filterStart, filterEnd);

test('the commit log filter has a stable localized accessible name', () => {
  assert.ok(filterStart >= 0 && filterEnd > filterStart, 'log filter input must remain present');
  assert.match(filter, /aria-label=\{t\('editor\.logFilter'\)\}/u);
  assert.match(filter, /title=\{t\('editor\.logFilterHint'\)\}/u);
  assert.match(filter, /placeholder=\{t\('editor\.logFilterPlaceholder'\)\}/u);
  assert.match(locales, /logFilter: '过滤提交',/u);
  assert.match(locales, /logFilter: 'Filter commits',/u);
});
