import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('multiple-caret actions advertise IDEA macOS shortcuts', () => {
  const selectAll = actions.slice(
    actions.indexOf("id: 'selectAllOccurrences'"),
    actions.indexOf("id: 'selectNextOccurrence'"),
  );
  const selectNext = actions.slice(
    actions.indexOf("id: 'selectNextOccurrence'"),
    actions.indexOf("id: 'unselectPreviousOccurrence'"),
  );
  const unselect = actions.slice(
    actions.indexOf("id: 'unselectPreviousOccurrence'"),
    actions.indexOf("id: 'findNext'"),
  );
  assert.match(selectAll, /shortcut: '⌃⌘G'/u);
  assert.match(selectNext, /shortcut: '⌃G'/u);
  assert.match(unselect, /shortcut: '⌃⇧G'/u);
});

test('macOS occurrence chords run before the generic Find Next handler', () => {
  const generic = source.slice(
    source.indexOf('/* IDEA\'s editor search family'),
    source.indexOf('const closeSearchEverywhere = React.useCallback'),
  );
  assert.match(generic, /const macMultipleCaretShortcut =\s*isMacPlatform/);
  assert.match(generic, /if \(macMultipleCaretShortcut\) return/);
  const guardAt = generic.indexOf('if (macMultipleCaretShortcut) return');
  const findNextAt = generic.indexOf("if (key === 'g')");
  assert.ok(guardAt >= 0 && findNextAt > guardAt);
});

test('macOS occurrence chords reuse Monaco selection commands', () => {
  const shortcutEffect = source.slice(
    source.indexOf('const platform = navigator.userAgentData?.platform'),
    source.indexOf('const searchEverywhereActions ='),
  );
  assert.match(shortcutEffect, /runWordOccurrence\('editor\.action\.selectHighlights'\)|runWordOccurrence\(command\)/);
  assert.match(shortcutEffect, /'editor\.action\.selectHighlights'/);
  assert.match(shortcutEffect, /'editor\.action\.addSelectionToNextFindMatch'/);
  assert.match(shortcutEffect, /'cursorUndo'/);
  assert.match(shortcutEffect, /event\.preventDefault\(\)/);
  assert.match(shortcutEffect, /event\.stopPropagation\(\)/);
});

test('macOS platform detection is pure and case-insensitive', () => {
  assert.match(source, /function isMacPlatform\(\s*platform: unknown\b/);
  assert.match(source, /\/mac\|iphone\|ipad\|ipod\/iu/);
});
