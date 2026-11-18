import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const comment = source.indexOf("/* IDEA's editor search family: ⌘F Find");
const effectStart = source.indexOf('React.useEffect(() => {', comment);
const shortcut = source.slice(comment, source.indexOf('\n      }, [', effectStart));

test('Search Everywhere only defers the Replace key to its own handler', () => {
  assert.match(shortcut, /const key = event\.key\.toLowerCase\(\);/);
  assert.match(shortcut, /if \(searchEverywhereOpen && key === 'r'\) return;/);
  assert.doesNotMatch(shortcut, /if \(searchEverywhereOpen\) return;/);
  assert.ok(shortcut.indexOf("const key = event.key.toLowerCase();") < shortcut.indexOf("if (searchEverywhereOpen && key === 'r') return;"));
});

test('Cmd/Ctrl+F and Shift+Cmd/Ctrl+F still reach the editor find actions', () => {
  assert.match(shortcut, /if \(key === 'f' && event\.shiftKey\)/);
  assert.match(shortcut, /openFindInFilesFromShortcut\(\)/);
  assert.match(shortcut, /if \(searchEverywhereOpen && key === 'f' && !event\.shiftKey\) setSearchEverywhere\(null\)/);
  assert.match(shortcut, /openEditorFindFromShortcut\(event\.altKey\)/);
});
