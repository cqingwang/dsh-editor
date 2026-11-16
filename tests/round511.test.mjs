import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const comment = source.indexOf("/* IDEA's editor search family: ⌘F Find");
const shortcut = source.slice(comment, source.indexOf("}, [openEditorFind, openFindTool, searchEverywhereOpen, currentCodeEditor]);", comment));

test('Find Next from Search Everywhere returns focus to the editor', () => {
  const start = shortcut.indexOf("if (key === 'g')");
  const branch = shortcut.slice(start, shortcut.indexOf("if (searchEverywhereOpen && key === 'f'", start));
  assert.match(branch, /currentCodeEditor\(\)\?\.focus\?\.\(\)/);
  assert.match(branch, /window\.setTimeout/);
  assert.match(branch, /setSearchEverywhere\(null\)/);
});

test('the focus target is an editor, not another search surface', () => {
  const branch = shortcut.slice(shortcut.indexOf("if (key === 'g')"));
  assert.doesNotMatch(branch.slice(0, branch.indexOf('return;')), /input\[|focusFind/);
});
