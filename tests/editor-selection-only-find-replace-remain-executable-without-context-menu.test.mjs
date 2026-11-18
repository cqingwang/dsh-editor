import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
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
  let state = null;
  let focused = null;
  const openEditorFindInSelection = loadTypeScriptCallback(workspaceSource, 'openEditorFindInSelection', {
    currentCodeEditor: () => ({
      getModel: () => ({
        getValue: () => 'alpha beta alpha',
      }),
    }),
    readSearchOptions: () => ({}),
    editorFindResult: (text, query) => ({
      matches: query === '' ? [] : [{ offset: text.indexOf(query), length: query.length, text: query }],
      error: null,
    }),
    setReplaceState: (updater) => {
      state = updater(state);
    },
    window: { setTimeout: (callback) => callback() },
    document: {
      querySelector: (selector) => ({
        focus: () => {
          focused = selector;
        },
      }),
    },
  });
  openEditorFindInSelection({ start: 0, end: 10 }, true, '  alpha  ', 'replace');
  assert.equal(state.find, 'alpha');
  assert.equal(state.withReplace, true);
  assert.deepEqual(state.scope, { start: 0, end: 10 });
  assert.equal(state.index, 0);
  assert.equal(focused, '[data-dsh-editor-find-replace-input]');
});
