import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Search Everywhere restores query focus after closing Filter', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const searchInputRef = React\.useRef\(null\)/);
  assert.match(dialog, /const closeFilterMenu = React\.useCallback/);
  assert.match(dialog, /setFilterMenu\(null\)/);
  assert.match(dialog, /searchInputRef\.current\?\.focus\(\)/);
  assert.match(dialog, /ref: searchInputRef/);
  assert.match(dialog, /onClose: closeFilterMenu/);
});

test('Filter menu still supports continuous toggles without closing', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /keepOpen: true/);
  assert.match(source, /item\.keepOpen !== true\) onClose\(\)/);
});

test('slash content ranks literally without provider remapping', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.match(dialog, /rankSearchActions\(actions, effectiveQuery, recentCommands, \{/);
});
