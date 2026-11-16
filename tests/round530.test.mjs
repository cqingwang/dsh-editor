import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function createGroupHarness() {
  const createGroup = new Function(
    'detectTheme',
    'EDITOR_UI_FONT',
    `let codeEditorGroupSequence = 0;
     ${extractSource('isMacPlatform')}
     ${extractSource('ideaControlKeyModifier')}
     ${extractSource('findUsagesSearchTarget')}
     ${extractSource('editorFindSelectionScope')}
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

test('the editor context menu offers Find Usages through a scoped precondition', () => {
  const harness = createGroupHarness();
  const invoked = [];
  harness.createGroup(harness.monaco, {}, {
    findUsagesLabel: 'Find Usages…',
    onFindUsages: (editor) => invoked.push(editor),
  });
  const action = harness.actions.find((entry) => entry.id.startsWith('dsh-editor.findUsages'));
  assert.ok(action);
  assert.equal(action.label, 'Find Usages…');
  assert.equal(action.contextMenuGroupId, 'navigation');
  assert.equal(action.contextMenuOrder, 1.1);
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
  const runnerRef = source.indexOf('const findUsagesRunnerRef = React.useRef(null)');
  const mainGroup = source.indexOf('const group = createCodeEditorGroup(monaco, containerRef.current');
  const splitGroup = source.indexOf('const group = createCodeEditorGroup(monaco, splitContainerRef.current');
  assert.ok(runnerRef > 0 && runnerRef < mainGroup && runnerRef < splitGroup);
  assert.doesNotMatch(
    source.slice(mainGroup, source.indexOf('}, [closeDiff, monacoReady', mainGroup)),
    /openFindTool/u,
  );
  assert.doesNotMatch(
    source.slice(splitGroup, source.indexOf('}, [closeSplitTab, monacoReady', splitGroup)),
    /openFindTool/u,
  );
});
