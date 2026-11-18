import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Search Everywhere owns Cmd/Ctrl+R while it is open', () => {
  const component = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(component, /window\.addEventListener\('keydown', onKeyDown, true\)/);
  assert.match(component, /const replaceShortcut = \(event\) => \{/);
  assert.match(component, /event\?\.metaKey === true \|\| event\?\.ctrlKey === true/);
  assert.match(component, /event\?\.key\?\.toLowerCase\?\.\(\) !== 'r'/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.stopPropagation\(\)/);
});

test('content Replace shortcut reuses the active-result handoff', () => {
  const component = source.slice(source.indexOf('const openSearchResultsInFind ='), source.indexOf('const headerActions ='));
  assert.match(component, /const replaceShortcut = \(event\) => \{/);
  assert.match(component, /fileMatches\.length > 0 \|\| textResults\.length > 0/);
  assert.match(component, /openSearchResultsInFind\('replace', activeResult\)/);
  assert.match(component, /onOpenInFindToolWindow\(\{\s*query: '',\s*mode: 'replace'/);
});

test('the editor Find shortcut does not steal Search Everywhere replace', () => {
  const comment = source.indexOf("/* IDEA's editor search family: ⌘F Find");
  const shortcut = source.slice(comment, source.indexOf("}, [openEditorFind, openFindTool, searchEverywhereOpen]);", comment));
  assert.match(shortcut, /if \(searchEverywhereOpen && key === 'r'\) return;/);
});
