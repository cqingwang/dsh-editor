import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const comment = source.indexOf("/* IDEA's editor search family: ⌘F Find");
const shortcut = source.slice(comment, source.indexOf("}, [openEditorFind, openFindTool, searchEverywhereOpen]);", comment));

test('editor Find Next and Previous are available as global search shortcuts', () => {
  assert.match(shortcut, /key !== 'g'/);
  assert.match(shortcut, /if \(key === 'g'\)/);
  assert.match(shortcut, /editorFindStepRef\.current\?\.\(event\.shiftKey \? -1 : 1\)/);
});

test('Find Next from Search Everywhere closes the dialog before stepping', () => {
  const start = shortcut.indexOf("if (key === 'g')");
  const branch = shortcut.slice(start, shortcut.indexOf("if (searchEverywhereOpen && key === 'f'", start));
  assert.match(branch, /setSearchEverywhere\(null\)/);
  assert.match(branch, /event\.preventDefault\(\)/);
  assert.match(branch, /event\.stopPropagation\(\)/);
});

test('the search-family shortcut remains host-scoped', () => {
  const hostCheck = shortcut.indexOf('host.contains(document.activeElement)');
  assert.ok(hostCheck >= 0 && hostCheck < shortcut.indexOf("if (key === 'g')"));
});
