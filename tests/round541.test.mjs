import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Search Everywhere exposes IDEA multiple-caret search actions', () => {
  assert.match(actions, /id: 'selectAllOccurrences'/);
  assert.match(actions, /label: t\('editor\.selectAllOccurrencesAction'\)/);
  assert.match(actions, /run: \(\) => runWordOccurrence\('editor\.action\.selectHighlights'\)/);

  assert.match(actions, /id: 'selectNextOccurrence'/);
  assert.match(actions, /label: t\('editor\.selectNextOccurrenceAction'\)/);
  assert.match(actions, /run: \(\) => runWordOccurrence\('editor\.action\.addSelectionToNextFindMatch'\)/);

  assert.match(actions, /id: 'unselectPreviousOccurrence'/);
  assert.match(actions, /label: t\('editor\.unselectPreviousOccurrenceAction'\)/);
  assert.match(actions, /run: \(\) => runWordOccurrence\('cursorUndo'\)/);
});

test('multiple-caret actions reuse the selection/caret availability model', () => {
  const family = actions.slice(
    actions.indexOf("id: 'selectAllOccurrences'"),
    actions.indexOf("id: 'findNext'"),
  );
  assert.equal((family.match(/disabled: findUsagesTarget\.query === ''/g) ?? []).length, 3);
  assert.equal((family.match(/findUsagesTarget\.reason === 'editor'/g) ?? []).length, 3);
  assert.equal((family.match(/editor\.findEditorRequired/g) ?? []).length, 3);
  assert.equal((family.match(/editor\.findUsagesSymbolRequired/g) ?? []).length, 3);
});

test('multiple-caret actions return focus through the shared runner', () => {
  const runner = source.slice(
    source.indexOf('const runWordOccurrence = React.useCallback'),
    source.indexOf('const searchEverywhereActions = React.useMemo'),
  );
  assert.match(runner, /closeSearchEverywhere\(\)/);
  assert.match(runner, /activeSourceEditor\.getAction\?\.\(command\)\?\.run\?\.\(\)/);
  assert.match(runner, /\.finally\(\(\) => activeSourceEditor\.focus\?\.\(\)\)/);
});

test('multiple-caret search actions are localized in both dictionaries', () => {
  assert.match(source, /selectAllOccurrencesAction: '选择所有匹配项'/);
  assert.match(source, /selectNextOccurrenceAction: '将下一个匹配项添加到选择'/);
  assert.match(source, /unselectPreviousOccurrenceAction: '取消选择匹配项'/);
  assert.match(source, /selectAllOccurrencesAction: 'Select All Occurrences'/);
  assert.match(source, /selectNextOccurrenceAction: 'Add Selection for Next Occurrence'/);
  assert.match(source, /unselectPreviousOccurrenceAction: 'Unselect Occurrence'/);
});
