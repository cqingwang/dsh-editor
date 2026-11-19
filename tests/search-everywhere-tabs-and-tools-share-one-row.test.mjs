import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dialog = await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8');
const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');
const uiStyles = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');

test('Search Everywhere keeps tabs and the compact tool group in one header row', () => {
  assert.match(
    dialog,
    /data-dsh-search-drag-surface=''[\s\S]*?role='tablist'[\s\S]*?data-dsh-search-open-find-tool-window=''/u,
  );
  assert.match(dialog, /data-dsh-search-toolbar-group=''/u);
  assert.doesNotMatch(dialog, /<\/div>\s*<div data-dsh-search-open-find-tool-window=''>/u);
  assert.match(dialog, /<CompactActionBar/u);
  assert.match(dialog, /slotWidth=\{30\}/u);
});

test('narrow Search Everywhere compresses spacing without hiding tabs', () => {
  assert.match(dialog, /containerType: 'inline-size'/u);
  assert.match(dialog, /gap: 'clamp\(8px, 2\.8cqi, 22px\)'/u);
  assert.match(dialog, /overflowX: 'auto'/u);
  assert.match(dialog, /flex: '0 0 auto',\s+width: 'min\(40%, 320px\)'/u);
  for (const source of [inlineStyles, uiStyles]) {
    const tabs = source.slice(source.indexOf('searchEverywhereTabs: {'), source.indexOf('searchEverywhereTab: {'));
    assert.match(tabs, /gap: 'clamp\(8px, 2\.8cqi, 22px\)'/u);
    assert.match(tabs, /padding: '0 clamp\(8px, 2cqi, 16px\)'/u);
  }
});
