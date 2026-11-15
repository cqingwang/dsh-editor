import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

test('terminal screen menu exposes IDEA Switch Focus To Editor without refocusing the terminal', () => {
  const terminalMenuModel = new Function(
    `'use strict';\n${extractFunction('terminalMenuModel')}\nreturn terminalMenuModel;`,
  )();
  let focused = 0;
  const menu = terminalMenuModel({
    t: (key) => key,
    emulator: { getSelection: () => '' },
    active: null,
    onSelectAll: () => {},
    onFind: () => {},
    onClear: () => {},
    onClearBuffer: () => {},
    onCreate: () => {},
    onSplitRight: null,
    onMoveToEditor: null,
    onSwitchFocusToEditor: () => { focused += 1; },
    onClipboardError: () => {},
    onPastedText: () => {},
    pasteHistory: [],
    onPasteHistory: () => {},
  });
  const item = menu.items.find((entry) => entry?.id === 'switchFocusToEditor');
  assert.ok(item, 'switchFocusToEditor item is missing');
  assert.equal(item.label, 'editor.terminalSwitchFocusToEditor');
  assert.equal(item.restoreFocus, false);
  item.run();
  assert.equal(focused, 1);
});

test('terminal tab menu also exposes Switch Focus To Editor', () => {
  const terminalTabMenu = new Function(
    `'use strict';\n${extractFunction('terminalTabMenu')}\nreturn terminalTabMenu;`,
  )();
  let focused = 0;
  const items = terminalTabMenu((key) => key, { id: 't1', title: 'shell', cwd: '/w' }, {
    rename: () => {},
    cycleColor: () => {},
    duplicate: () => {},
    canMoveLeft: false,
    canMoveRight: false,
    moveLeft: null,
    moveRight: null,
    splitRight: null,
    reopen: null,
    moveToEditor: null,
    switchFocusToEditor: () => { focused += 1; },
    close: () => {},
    closeOthers: () => {},
  });
  const item = items.find((entry) => entry?.id === 'switchFocusToEditor');
  assert.ok(item);
  assert.equal(item.restoreFocus, false);
  item.run();
  assert.equal(focused, 1);
});

test('workspace routes focus requests to the active diff or Monaco editor', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /onSwitchFocusToEditor: focusEditorFromTerminal/);
  assert.match(workspace, /const focusEditorFromTerminal = React\.useCallback\(\(\) => \{/);
  assert.match(workspace, /dsh-editor-focus-diff/);
  assert.match(workspace, /editorRef\.current\?\.focus\(\)/);
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /addEventListener\('dsh-editor-focus-diff'/);
});

test('terminal focus wording exists in both dictionaries', () => {
  assert.ok(source.split('terminalSwitchFocusToEditor:').length - 1 >= 2);
});
