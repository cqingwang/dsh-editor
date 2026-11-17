import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Monaco context menu exposes the multiple-caret search family', () => {
  assert.match(group, /id: `dsh-editor\.selectAllOccurrences\.\$\{groupId\}`/);
  assert.match(group, /id: `dsh-editor\.selectNextOccurrence\.\$\{groupId\}`/);
  assert.match(group, /id: `dsh-editor\.unselectPreviousOccurrence\.\$\{groupId\}`/);
  assert.equal((group.match(/precondition: findUsagesPrecondition/g) ?? []).length, 13);
  assert.equal((group.match(/contextMenuGroupId: 'navigation'/g) ?? []).length, 17);
});

test('context menu actions reuse the same Monaco commands and restore focus', () => {
  assert.match(group, /const runSearchCommand = \(command\) =>/);
  assert.match(group, /editor\.getAction\?\.\(command\)/);
  assert.match(group, /\.finally\(\(\) => editor\.focus\?\.\(\)\)/);
  assert.match(group, /runSearchCommand\('editor\.action\.selectHighlights'\)/);
  assert.match(group, /runSearchCommand\('editor\.action\.addSelectionToNextFindMatch'\)/);
  assert.match(group, /runSearchCommand\('cursorUndo'\)/);
});

test('both editor groups pass localized multiple-caret menu labels', () => {
  assert.equal((source.match(/selectAllOccurrencesLabel: t\('editor\.selectAllOccurrencesAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/selectNextOccurrenceLabel: t\('editor\.selectNextOccurrenceAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/unselectPreviousOccurrenceLabel: t\('editor\.unselectPreviousOccurrenceAction'\)/g) ?? []).length, 2);
});

test('context menu actions do not mutate selections before the user chooses them', () => {
  const actionFamily = group.slice(
    group.indexOf('id: `dsh-editor.selectAllOccurrences.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.doesNotMatch(actionFamily, /setSelection|setSelections|openSearchEverywhere|closeSearchEverywhere/);
});
