import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source = [
  workspaceSource,
  await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8'),
].join('\n');

function extractSource(name) {
  return transpileTypeScriptFunction(source, name);
}

function createGroupHarness() {
  const createGroup = new Function(
    'detectTheme',
    'EDITOR_UI_FONT',
    `let codeEditorGroupSequence = 0;
     const EDITOR_CODE_FONT_SIZE = 13;
     const EDITOR_CODE_LINE_HEIGHT = 20;
     ${extractSource('isMacPlatform')}
     ${extractSource('ideaControlKeyModifier')}
     ${extractSource('findUsagesSearchTarget')}
     ${extractSource('editorFindSelectionScope')}
     ${extractSource('filterMonacoContextMenuActions')}
     ${extractSource('createCodeEditorGroup')};
     return createCodeEditorGroup;`,
  )(() => 'vs', 'monospace');
  const actions = [];
  const contextKeys = new Map();
  const subscriptions = {};
  let position = { lineNumber: 1, column: 1 };
  let model = null;
  const editor = {
    addAction(config) {
      actions.push(config);
      return { dispose() {} };
    },
    getModel: () => model,
    getSelection: () => ({ isEmpty: () => true, getPosition: () => position }),
    getPosition: () => position,
    createContextKey(key, defaultValue) {
      contextKeys.set(key, defaultValue);
      return { set: (value) => contextKeys.set(key, value) };
    },
    onDidChangeCursorSelection(callback) {
      subscriptions.selection = callback;
      return { dispose() {} };
    },
    onDidChangeModel(callback) {
      subscriptions.model = callback;
      return { dispose() {} };
    },
    dispose() {},
  };
  const monaco = {
    editor: {
      create: () => editor,
    },
    KeyMod: { CtrlCmd: 1, Alt: 2, WinCtrl: 3 },
    KeyCode: { KeyS: 1, KeyF: 2, KeyL: 3, KeyW: 4 },
  };
  return {
    createGroup,
    actions,
    contextKeys,
    subscriptions,
    editor,
    monaco,
    setTarget(nextModel, nextPosition = position) {
      model = nextModel;
      position = nextPosition;
    },
  };
}

test('Find Usages remains executable without the redundant context-menu row', () => {
  const harness = createGroupHarness();
  const invoked = [];
  harness.createGroup(harness.monaco, {}, {
    findUsagesLabel: 'Find Usages…',
    onFindUsages: (editor) => invoked.push(editor),
  });
  const action = harness.actions.find((entry) => entry.id.startsWith('dsh-editor.findUsages'));
  assert.ok(action);
  assert.equal(action.label, 'Find Usages…');
  assert.equal(action.contextMenuGroupId, undefined);
  assert.equal(action.contextMenuOrder, undefined);
  assert.match(action.precondition, /^dshEditorFindUsagesAvailable\d+$/u);
  assert.equal(harness.contextKeys.get(action.precondition), false);
  action.run();
  assert.deepEqual(invoked, [harness.editor]);
});

test('the context-menu precondition follows the same selection or caret resolver', () => {
  const harness = createGroupHarness();
  harness.createGroup(harness.monaco, {}, { onFindUsages() {} });
  const action = harness.actions.find((entry) => entry.id.startsWith('dsh-editor.findUsages'));
  assert.ok(action);
  harness.setTarget({
    getValueInRange: () => '',
    getWordAtPosition: () => ({ word: 'needle' }),
  });
  harness.subscriptions.selection?.();
  assert.equal(harness.contextKeys.get(action.precondition), true);
  harness.setTarget({
    getValueInRange: () => '',
    getWordAtPosition: () => null,
  });
  harness.subscriptions.model?.();
  assert.equal(harness.contextKeys.get(action.precondition), false);
});

test('both editor groups hand the invoking editor to the shared Find Usages path', () => {
  assert.match(source, /onFindUsages: \(editor\) => findUsagesRunnerRef\.current\?\.\(editor\)/u);
  const handlers = source.match(/onFindUsages: \(editor\) => findUsagesRunnerRef\.current\?\.\(editor\)/gu) ?? [];
  assert.equal(handlers.length, 2);
  assert.match(source, /findUsagesRunnerRef\.current = \(editor\) => \{/u);
  assert.match(source, /const target = findUsagesSearchTarget\(editor\);/u);
  assert.match(source, /if \(target\.query !== ''\) openFindUsages\(target\.query\);/u);
});

test('per-editor context keys use the instance API and avoid the callback TDZ', () => {
  assert.match(source, /editor\.createContextKey\?\.\(findUsagesPrecondition, false\)/u);
  assert.doesNotMatch(source, /monaco\.editor\.createContextKey/u);
  const runnerRef = workspaceSource.indexOf('const findUsagesRunnerRef =');
  const mainGroup = workspaceSource.indexOf('const group = createCodeEditorGroup(monaco, containerRef.current');
  const splitGroup = workspaceSource.indexOf('const group = createCodeEditorGroup(monaco, splitContainerRef.current');
  assert.ok(runnerRef > 0 && runnerRef < mainGroup && runnerRef < splitGroup);
  const mainEnd = source.indexOf('const editor = group.editor;', mainGroup);
  const splitEnd = source.indexOf('const editor = group.editor;', splitGroup);
  assert.doesNotMatch(
    workspaceSource.slice(mainGroup, mainEnd),
    /openFindTool/u,
  );
  assert.doesNotMatch(
    workspaceSource.slice(splitGroup, splitEnd),
    /openFindTool/u,
  );
});
