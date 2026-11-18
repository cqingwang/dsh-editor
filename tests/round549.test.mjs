import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Monaco context menu exposes next and previous word occurrences', () => {
  const next = group.slice(
    group.indexOf('id: `dsh-editor.findWordAtCaret.${groupId}`'),
    group.indexOf('id: `dsh-editor.previousWordOccurrence.${groupId}`'),
  );
  const previous = group.slice(
    group.indexOf('id: `dsh-editor.previousWordOccurrence.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(next, /label: actionsHandlers\.findWordAtCaretLabel \?\? 'Next Occurrence of the Word at Caret'/);
  assert.match(next, /precondition: findUsagesPrecondition/);
  assert.match(next, /contextMenuGroupId: 'navigation'/);
  assert.match(next, /contextMenuOrder: 2\.0/);
  assert.match(next, /runSearchCommand\('editor\.action\.nextSelectionMatchFindAction'\)/);

  assert.match(previous, /label: actionsHandlers\.previousWordOccurrenceLabel \?\? 'Previous Occurrence of the Word at Caret'/);
  assert.match(previous, /precondition: findUsagesPrecondition/);
  assert.match(previous, /contextMenuGroupId: 'navigation'/);
  assert.match(previous, /contextMenuOrder: 2\.1/);
  assert.match(previous, /runSearchCommand\('editor\.action\.previousSelectionMatchFindAction'\)/);
});

test('both editor groups pass localized word occurrence menu labels', () => {
  assert.equal((source.match(/findWordAtCaretLabel: t\('editor\.nextWordOccurrenceAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/previousWordOccurrenceLabel: t\('editor\.previousWordOccurrenceAction'\)/g) ?? []).length, 2);
});

test('word occurrence actions reuse the shared search command focus path', () => {
  assert.match(group, /const runSearchCommand = \(command\) =>/);
  assert.match(group, /\.finally\(\(\) => editor\.focus\?\.\(\)\)/);
  const family = group.slice(
    group.indexOf('id: `dsh-editor.findWordAtCaret.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.doesNotMatch(family, /setSelection|setSelections|openSearchEverywhere|closeSearchEverywhere/);
});
