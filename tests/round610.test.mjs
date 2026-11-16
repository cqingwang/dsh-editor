import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);
const dialogStart = source.indexOf('function SearchEverywhere(');
const dialogEnd = source.indexOf('function FindToolWindow(', dialogStart);
const dialog = source.slice(dialogStart, dialogEnd);

function actionBlock(id) {
  const start = actions.indexOf(`id: '${id}'`);
  assert.notEqual(start, -1, `${id} is missing`);
  const end = actions.indexOf("id: '", start + 1);
  return actions.slice(start, end < 0 ? actions.length : end);
}

test('item info owns focus while open and returns it to the query', () => {
  assert.match(dialog, /const resultInfoCloseRef = React\.useRef\(null\)/);
  assert.match(
    dialog,
    /React\.useEffect\(\(\) => \{[\s\S]*?resultInfoCloseRef\.current\?\.focus\?\.\(\)[\s\S]*?\}, \[resultInfo\]\)/,
  );
  assert.match(dialog, /ref: resultInfoCloseRef/);
  assert.match(dialog, /setResultInfo\(null\);[\s\S]*?searchInputRef\.current\?\.focus\?\.\(\)/);
});

test('dialog-level Escape closes Item Info regardless of focused control', () => {
  assert.match(dialog, /const handleSearchEverywhereDialogKeyDown = \(event\) =>/);
  assert.match(
    dialog,
    /if \(event\.key === 'Escape' && resultInfo !== null\)[\s\S]*?closeResultInfo\(\)[\s\S]*?return;/,
  );
  assert.match(dialog, /onKeyDown: handleSearchEverywhereDialogKeyDown/);
  assert.match(dialog, /openSearchHistoryShortcut\(event\)/);
});

test('every shortcut-bearing Search Everywhere Action has a real execution path', () => {
  for (const [id, route] of [
    ['goToFile', /openQuickOpen\(\)/],
    ['recentFiles', /openRecent\(\)/],
    ['textSearch', /setSearchEverywhere\(/],
    ['findAction', /setSearchEverywhere\(/],
    ['showSearchHistory', /setSearchHistoryRequest/],
    ['find', /openEditorFind\(false\)/],
    ['replace', /openEditorFind\(true\)/],
    ['searchInSelectionOnly', /openEditorFindInSelection\(/],
    ['findUsages', /openFindUsages\(/],
    ['showUsages', /openShowUsages\(/],
    ['findUsagesSettings', /disabled: true/],
    ['findUsagesInFile', /openEditorFind\(/],
    ['highlightUsagesInFile', /wordHighlight\.trigger/],
    ['findNextWordOccurrence', /runWordOccurrence\(/],
    ['findPreviousWordOccurrence', /runWordOccurrence\(/],
    ['selectAllOccurrences', /runWordOccurrence\(/],
    ['selectNextOccurrence', /runWordOccurrence\(/],
    ['unselectPreviousOccurrence', /runWordOccurrence\(/],
    ['findNext', /editorFindStepRef\.current/],
    ['findPrevious', /editorFindStepRef\.current/],
    ['searchInChanges', /diffSearchInChangesRef\.current/],
    ['findInFiles', /openFindTool\(/],
    ['replaceInFiles', /openFindTool\(/],
  ]) {
    const block = actionBlock(id);
    assert.match(block, /shortcut:/, `${id} lost its shortcut metadata`);
    assert.match(block, route, `${id} shortcut has no execution route`);
  }
});

test('shortcut Actions stay unique and no unregistered shortcut row appears', () => {
  const ids = [...actions.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  assert.equal(duplicate, undefined);
});
