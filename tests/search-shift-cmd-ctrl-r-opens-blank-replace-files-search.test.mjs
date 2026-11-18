import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const component = source.slice(
  source.indexOf('function SearchEverywhere('),
  source.indexOf('export { SearchEverywhere };'),
);
const shortcut = component.slice(component.indexOf('const replaceShortcut ='), component.indexOf('const headerActions ='));

test('Shift+Cmd/Ctrl+R opens a blank Replace in Files from Search Everywhere', () => {
  assert.match(shortcut, /event\?\.shiftKey === true/);
  assert.match(shortcut, /openBlankReplaceInFiles\(\)/);
  assert.ok(shortcut.indexOf('event?.shiftKey === true') < shortcut.indexOf('fileMatches.length > 0'));
});

test('plain Cmd/Ctrl+R still hands off the active content result', () => {
  assert.match(shortcut, /fileMatches\.length > 0 \|\| textResults\.length > 0/);
  assert.match(shortcut, /openSearchResultsInFind\('replace', activeResult\)/);
});

test('the blank Replace request remains a single shared request builder', () => {
  assert.equal((component.match(/onOpenInFindToolWindow\(\{\s*query: '',\s*mode: 'replace'/g) ?? []).length, 1);
  assert.match(component, /const openBlankReplaceInFiles = \(\) =>/);
});
