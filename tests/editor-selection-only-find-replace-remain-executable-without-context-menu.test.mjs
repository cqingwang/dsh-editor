import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('selection-only Find and Replace remain executable without context-menu duplicates', () => {
  const find = group.slice(
    group.indexOf('id: `dsh-editor.findInSelection.${groupId}`'),
    group.indexOf('id: `dsh-editor.replaceInSelection.${groupId}`'),
  );
  const replace = group.slice(
    group.indexOf('id: `dsh-editor.replaceInSelection.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(find, /label: actionsHandlers\.findInSelectionLabel \?\? 'Search in Selection Only'/);
  assert.match(find, /precondition: findSelectionPrecondition/);
  assert.doesNotMatch(find, /contextMenuGroupId|contextMenuOrder/);
  assert.match(find, /actionsHandlers\.onFindInSelection\?\.\(editor\)/);

  assert.match(replace, /label: actionsHandlers\.replaceInSelectionLabel \?\? 'Replace in Selection Only'/);
  assert.match(replace, /precondition: findSelectionPrecondition/);
  assert.doesNotMatch(replace, /contextMenuGroupId|contextMenuOrder/);
  assert.match(replace, /actionsHandlers\.onReplaceInSelection\?\.\(editor\)/);
});

test('selection-only precondition requires both a symbol query and non-empty selection', () => {
  assert.match(group, /const findSelectionPrecondition = `dshEditorFindSelectionAvailable\$\{groupId\}`/);
  assert.match(group, /editor\.createContextKey(?:<[^()]*>)?\(findSelectionPrecondition, false\)/);
  assert.match(group, /queryAvailable && editorFindSelectionScope\(editor\) !== null/);
});

test('both editor groups localize and route selection-only actions', () => {
  assert.equal((source.match(/findInSelectionLabel: t\('editor\.searchInSelectionOnly'\)/g) ?? []).length, 2);
  assert.equal((source.match(/replaceInSelectionLabel: t\('editor\.replaceInSelectionOnly'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onFindInSelection: \(editor\) => selectionFindContextRunnerRef\.current\?\.\(editor, false, 'query'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onReplaceInSelection: \(editor\) => selectionFindContextRunnerRef\.current\?\.\(editor, true, 'replace'\)/g) ?? []).length, 2);
});

test('selection-only actions reuse the current editor Find/Replace chain', () => {
  const runner = source.slice(
    source.indexOf("selectionFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {"),
    source.indexOf('}, [openEditorFindInSelection]);', source.indexOf('selectionFindContextRunnerRef.current = (editor, withReplace = false')),
  );
  assert.match(runner, /const scope = editorFindSelectionScope\(editor\)/);
  assert.match(runner, /const target = findUsagesSearchTarget\(editor\)/);
  assert.match(runner, /if \(scope === null \|\| target\.query === ''\) return/);
  assert.match(runner, /openEditorFindInSelection\(scope, withReplace, target\.query, focusTarget\)/);
});

test('selection Find accepts an explicit query and focus target without a second state path', () => {
  const opener = source.slice(
    source.indexOf('const openEditorFindInSelection = React.useCallback'),
    source.indexOf("/* IDEA's editor search family"),
  );
  assert.match(opener, /\(scope, withReplace = null, initialQuery = null, focusTarget = null\) =>/);
  assert.match(opener, /const requestedFind = typeof initialQuery === 'string' \? initialQuery\.trim\(\) : ''/);
  assert.match(opener, /const hasExplicitQuery = typeof initialQuery === 'string'/);
  assert.match(opener, /const find = hasExplicitQuery \? requestedFind : base\.find/);
  assert.match(opener, /index: hasExplicitQuery \? 0 : Math\.min/);
  assert.match(opener, /focusTarget === 'replace'/);
  assert.match(opener, /}, 40\);/);
});
